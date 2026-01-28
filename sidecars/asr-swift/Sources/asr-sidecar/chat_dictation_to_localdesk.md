## Chat dictation (voice input) — port from Lintu to LocalDesk

### Goal

- **In-chat voice input**: user clicks the mic button in the chat input → recording UI (waveform) is shown → user clicks Stop → **the transcript is inserted into the prompt input**. The user then presses **Enter** to send (no auto-send).
- **Language**: Parakeet TDT v3 is expected to work for RU in this setup.
- **Target for MVP**: **macOS only**.

### LocalDesk integration constraints (what we build on)

- **IPC topology**:
  - **UI → host**: `ClientEvent` via Tauri command `client_event` (see `LocalDesk/src-tauri/src/main.rs`).
  - **Host → UI**: Tauri event `"server-event"` with JSON payload (see `LocalDesk/src/ui/platform/tauri.ts`).
- **Existing Node sidecar**:
  - The Node sidecar is the agent runtime.
  - ASR should be a **separate sidecar process** (macOS: Swift/CoreML) controlled by the **Rust host**, and surfaced to UI via `"server-event"` (same as everything else).

### Proposed IPC contract (events)

> Naming avoids collisions with LocalDesk’s existing `models.*` (LLM models) and keeps all speech features under `audio.*`.

- **Client → Host (`ClientEvent`)**:
  - **`audio.dictation.start`**: `{ dictationId: string }` (and later: `{ deviceId?: string }`)
  - **`audio.dictation.stop`**: `{ dictationId: string }`
  - **`audio.models.status.get`**: no payload (or `{}`) — request current status
  - **`audio.models.download.start`**: no payload (or `{}`) — start download of the required pack (TDT v3 + Silero VAD)
  - **`audio.settings.get` / `audio.settings.save`**: for persisting audio-related config in DB (not in `ApiSettings`)
  - **`audio.devices.list`**: later (Part 2)
- **Host → UI (`ServerEvent`)**:
  - **Dictation stream**: `audio.dictation.partial`, `audio.dictation.final`, `audio.dictation.audio_level`, `audio.dictation.done`, `audio.dictation.error`
  - **Models**: `audio.models.status`, `audio.models.download.progress`, `audio.models.download.done`, `audio.models.download.error`
  - **Settings**: `audio.settings.loaded`
  - **Devices**: `audio.devices.listed` (Part 2)

> Implementation note: these event unions exist in two places (`LocalDesk/src/ui/types.ts` and `LocalDesk/src/agent/types.ts`). Even if the Node sidecar doesn’t use them, the types should stay consistent to avoid drift.

---

## Part 1 — MVP (macOS only, includes permissions)

### Deliverables

- **Chat input dictation**:
  - **Mic button** in `PromptInput`.
  - **Waveform visualizer** during recording.
  - On Stop, **final transcript is inserted** into the input (no auto-send).
- **Audio models management**:
  - “Download speech models” button in Settings → Audio.
  - Progress + readiness status.
- **macOS permissions**:
  - App prompts for microphone permission and works after granting it.

### Steps

#### 1) Bring `asr-sidecar` (Swift/CoreML) into LocalDesk

- **Code location**: copy `Lintu/sidecars/asr-swift` → `LocalDesk/sidecars/asr-swift`.
- **Build script (macOS only)**:
  - Add `LocalDesk/scripts/build_asr_sidecar.sh` that runs `swift build -c release`.
  - Copy the resulting binary into `LocalDesk/src-tauri/bin/asr-sidecar-{target}` (target triple naming should match how LocalDesk names `valera-sidecar-*`).
- **Bundle**:
  - Add `"bin/asr-sidecar"` to `LocalDesk/src-tauri/tauri.conf.json -> bundle.externalBin` (same approach as `"bin/valera-sidecar"`).

#### 2) Add model pack download + status to Rust host

- **Manifest-driven** approach (ported from Lintu):
  - Keep a `model_manifest.json` with two required entries:
    - **Parakeet TDT v3 (CoreML)** (`asr_tdt_v3`)
    - **Silero VAD v6 (CoreML)** (`silero_vad_v6`)
- **Storage**:
  - Use LocalDesk’s `app_data_dir()/models/` (deterministic, already used for DB + settings).
- **Host commands**:
  - `audio.models.status.get` → reply with `audio.models.status`
  - `audio.models.download.start` → emit progress + done/error events
- **Checksum policy**:
  - If `sha256` is present → verify and fail fast on mismatch.
  - If `sha256` is empty → skip verification (but still validate size).

#### 3) Implement dictation session manager in Rust host

- **Lifecycle**:
  - `audio.dictation.start`:
    - Validate “models are ready” (fail fast with `audio.dictation.error` if not).
    - Spawn `asr-sidecar --models-dir <ABS_PATH>` (stderr + stdout piped).
    - Send init + `mic_start` via stdin.
  - `audio.dictation.stop`:
    - Send `mic_stop` via stdin, wait for sidecar exit, emit `audio.dictation.done`.
- **Stdout parsing**:
  - Parse NDJSON from Swift sidecar and map to server events:
    - `t=partial` → `audio.dictation.partial`
    - `t=final` → `audio.dictation.final`
    - `t=audio_level` → `audio.dictation.audio_level`
    - `t=error` → `audio.dictation.error`
- **Concurrency**:
  - Single active dictation session at a time (reject concurrent starts with `invalid_state`).

#### 4) UI integration in `PromptInput` (chat)

- **Controls**:
  - Add **mic toggle** next to the send button (Start/Stop).
- **Waveform**:
  - Reuse the concept from Lintu’s `WaveformVisualizer`, but keep state local to the component (avoid Zustand updates on high-frequency `audio_level`).
- **Transcript handling (UX requirement)**:
  - During recording: optionally show a small “live preview” text **outside** the input (do not mutate `prompt` while recording).
  - On `audio.dictation.done`: add current transcript string to `prompt` and focus the textarea. The transcript inserted in the end position if the prompt is not focused and into an cursor position if there is an active text input
  - Never auto-send; user hits **Enter**.

#### 5) Settings → add “Audio” section (models only in MVP)

- **Audio tab** in `LocalDesk/src/ui/components/SettingsModal.tsx`:
  - **Download speech models** (TDT v3 + Silero VAD)
  - **Status**: ready / downloading / not installed, and optional “Open models folder”.
- **Persistence**:
  - Do **not** store audio settings inside `ApiSettings`.
    - Reason: Rust-side `ApiSettings` in `LocalDesk/src-tauri/src/db.rs` is intentionally limited and will drop unknown fields when persisted.
  - Store audio-related config under a separate DB key, e.g. `settings.key = "audio_settings"` (JSON).

#### 6) macOS permission plumbing (must be part of MVP)

- **Info.plist**: add `NSMicrophoneUsageDescription` to the Tauri bundle (otherwise macOS may block mic access).
- **Runtime**:
  - Ensure the permission prompt happens on first dictation start.
  - Emit a clear `audio.dictation.error` if access is denied.

### Acceptance criteria

- **From a clean install** on macOS:
  - Without models: user sees a clear “models not ready” error and can download them in Settings → Audio.
  - With models: user can record, stop, and gets a non-empty transcript inserted into the input.
  - Nothing is auto-sent; Enter still sends.
  - Errors are surfaced with explicit codes/messages (no silent fallbacks).

---

## Part 2 — Add microphone selection (macOS)

> Note: this is intentionally deferred. Today `asr-sidecar` logs that `device_id` is not implemented and always uses the system default input device.

### Deliverables

- **Settings → Audio**:
  - List available microphones.
  - Persist selected microphone.
- **Dictation**:
  - `audio.dictation.start` uses the selected device (or “System default”).

### Steps

#### 1) Implement device enumeration in `asr-sidecar`

- Add a command (CLI or stdin cmd) to list input devices, e.g.:
  - **CLI**: `asr-sidecar --list-mic-devices` → prints JSON to stdout and exits.
- Return fields that are stable for persistence:
  - **`id`**: device UID (preferred) or another stable identifier
  - **`label`**: human-readable name

#### 2) Implement device selection in `mic_start`

- Use CoreAudio to resolve the selected device UID to an input device and route capture through it.
- If the requested device ID is unknown/unavailable:
  - Fail fast with a clear error (`audio.dictation.error`), and prompt the user to re-select.
  - Do not silently fall back to default.

#### 3) Host + UI wiring

- Host:
  - Add `audio.devices.list` → emits `audio.devices.listed`.
  - Add `audio.settings.get/save` for persisting `audio_settings.microphoneId`.
  - Pass `deviceId` into `mic_start`.
- UI:
  - Audio tab dropdown backed by `audio.devices.listed`.
  - Save selection via `audio.settings.save`.

---

## Part 3 — Windows / Linux support (future)

### Key reality check

- The current `asr-sidecar` is **Swift + CoreML + AVAudioEngine** → macOS only.
- To support Windows/Linux we will need a **different runtime and different model artifacts** (CoreML `.mlmodelc` won’t run there).

### Strategy (recommended): keep the IPC protocol stable, swap the implementation per OS

- **Keep UI + Rust-host event contract (`audio.*`) unchanged**.
- **Introduce OS-specific ASR sidecars** (or one cross-platform sidecar), all speaking the same NDJSON protocol.

### Implementation plan

#### 1) Choose the inference backend for Windows/Linux

- **Decision point**: we need a Windows/Linux-compatible ASR model + runtime.
  - If Parakeet TDT v3 is available in a cross-platform format (e.g. ONNX) → use it.
  - If not → pick a different offline ASR model that supports RU and has a stable runtime for Win/Linux.
- VAD:
  - Prefer using Silero VAD in a cross-platform format compatible with the chosen runtime (e.g. ONNX if the backend is ONNX Runtime).

#### 2) Build the sidecar(s)

- **Option A (one cross-platform sidecar)**:
  - Implement `asr-sidecar` in Rust:
    - Cross-platform mic capture (e.g. `cpal`).
    - VAD + streaming inference.
    - Output the same NDJSON messages (`partial`, `final`, `audio_level`, `error`).
- **Option B (per-OS sidecars)**:
  - Windows sidecar using WASAPI + chosen inference runtime.
  - Linux sidecar using PipeWire/PulseAudio + chosen inference runtime.

#### 3) Extend model management to multi-OS

- Extend the model manifest to include per-OS file lists and checksums:
  - `macos` (CoreML pack)
  - `windows` (runtime-specific pack)
  - `linux` (runtime-specific pack)
- Keep storage layout consistent under `app_data_dir()/models/`, but isolate per-runtime repos via `repo_dirname`.

#### 4) Bundle + runtime selection

- Bundle appropriate binaries via `bundle.externalBin` per target.
- Rust host resolves the correct ASR sidecar binary based on OS/arch and starts it with the same arguments.

### Acceptance criteria for Win/Linux milestone

- Models can be downloaded for the current OS.
- Dictation start/stop works, with waveform level + final transcript inserted into the input (no auto-send).
- Errors are explicit and actionable (missing models, missing permissions, device issues, sidecar crashes).  