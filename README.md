<div align="center">

# Agent Cowork - Local LLM Edition

[![Version](https://img.shields.io/badge/version-0.0.3-blue.svg)](https://github.com/vakovalskii/Cowork-Local-LLM/releases)
[![Platform](https://img.shields.io/badge/platform-%20Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/vakovalskii/Cowork-Local-LLM)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Desktop AI Assistant with Local Model Support**

> 🔱 Forked from [DevAgentForge/Claude-Cowork](https://github.com/DevAgentForge/Claude-Cowork)  
> Reworked to support OpenAI SDK and local models (vLLM, Qwen, Llama)

</div>

---

## ✨ Features

- ✅ **OpenAI SDK** — full API control, compatible with any OpenAI-compatible endpoint
- ✅ **Local Models** — vLLM, Ollama, LM Studio support
- ✅ **Modular Tools** — each tool in separate file for easy maintenance
- ✅ **Web Search** — Tavily integration for internet search (optional)
- ✅ **Security** — directory sandboxing for safe file operations
- ✅ **Cross-platform** — Windows, macOS, Linux with proper shell commands
- ✅ **Modern UI** — React + Electron with auto-scroll and streaming

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/vakovalskii/Cowork-Local-LLM.git
cd Cowork-Local-LLM

# Install dependencies (use bun for faster install)
bun install
# or
npm install

# Compile Electron code
npm run transpile:electron
```

### Running in Development

```bash
# Start both Vite and Electron
npm run dev
```

Or manually in two terminals:

**Terminal 1 - React Dev Server:**
```bash
npm run dev:react
```

**Terminal 2 - Electron (after Vite starts):**
```bash
# macOS/Linux
NODE_ENV=development npx electron .

# Windows PowerShell
$env:NODE_ENV='development'; npx electron .
```

### Configuration

1. Click **Settings** (⚙️) in the app
2. Configure your API:
   - **API Key** — your key (or `dummy-key` for local models)
   - **Base URL** — API endpoint
   - **Model Name** — model identifier
   - **Temperature** — 0.0-2.0 (default: 0.3)
   - **Tavily API Key** (optional) — for web search
3. Click **Save Settings**

### Example Configurations

**Local vLLM:**
```json
{
  "apiKey": "dummy-key",
  "baseUrl": "http://localhost:8000",
  "model": "qwen3-30b-a3b-instruct-2507",
  "temperature": 0.3
}
```

**Claude:**
```json
{
  "apiKey": "sk-ant-...",
  "baseUrl": "https://api.anthropic.com",
  "model": "claude-sonnet-4-20250514",
  "temperature": 0.3
}
```

**OpenAI:**
```json
{
  "apiKey": "sk-...",
  "baseUrl": "https://api.openai.com",
  "model": "gpt-4",
  "temperature": 0.3
}
```

## 🦙 Local Model Setup (vLLM)

```bash
vllm serve qwen3-30b-a3b-instruct-2507 \
  --port 8000 \
  --enable-auto-tool-choice \
  --tool-call-parser hermes
```

**Requirements:**
- OpenAI-compatible API (`/v1/chat/completions`)
- Function calling support
- Streaming support

## 🛠️ Available Tools

### File Operations
- **Bash** — execute shell commands (PowerShell/bash)
- **Read** — read file contents
- **Write** — create new files
- **Edit** — modify files (search & replace)

### Search Tools
- **Glob** — find files by pattern
- **Grep** — search text in files

### Web Tools (Optional)
- **WebSearch** — search the web using Tavily API
- **ExtractPageContent** — extract full content from web pages

### User Interaction
- **AskUserQuestion** — ask user for clarification

> **Note:** Web tools require Tavily API key in Settings

## 📦 Building

### macOS (DMG)
```bash
npm run dist:mac
```

### Windows (EXE)
```bash
npm run dist:win
```

### Linux (AppImage)
```bash
npm run dist:linux
```

## 🏗️ Project Structure

```
src/
├── electron/                    # Electron main process
│   ├── main.ts                 # Entry point
│   ├── ipc-handlers.ts         # IPC communication
│   └── libs/
│       ├── runner-openai.ts    # OpenAI API runner
│       ├── prompt-loader.ts    # Prompt template loader
│       ├── tools-executor.ts   # Tool execution logic
│       ├── prompts/
│       │   ├── system.txt      # System prompt template
│       │   └── initial_prompt.txt # Initial prompt template
│       └── tools/              # Modular tool definitions
│           ├── base-tool.ts    # Base interfaces
│           ├── bash-tool.ts    # Shell execution
│           ├── read-tool.ts    # File reading
│           ├── write-tool.ts   # File creation
│           ├── edit-tool.ts    # File editing
│           ├── glob-tool.ts    # File search
│           ├── grep-tool.ts    # Text search
│           ├── web-search.ts   # Web search (Tavily)
│           └── extract-page-content.ts # Page extraction
└── ui/                         # React frontend
    ├── App.tsx                 # Main component
    ├── components/             # UI components
    └── store/                  # Zustand state management
```

## 🔐 Data Storage

**Windows:** `C:\Users\YourName\AppData\Roaming\agent-cowork\`  
**macOS:** `~/Library/Application Support/agent-cowork/`  
**Linux:** `~/.config/agent-cowork/`

Files:
- `sessions.db` — SQLite database with chat history
- `api-settings.json` — API configuration
- `~/.agent-cowork/logs/` — request logs (debugging)

## ⚠️ Troubleshooting

**Model doesn't see command results?**
- Ensure your model supports function calling
- Check DevTools (F12) — should see `tool` messages in console

**vLLM returns 404?**
- Check Base URL (system automatically adds `/v1`)
- Verify vLLM is running: `curl http://localhost:8000/health`

**Cyrillic showing as `��������`?**
- Fixed in v0.0.3+

## 🤝 Contributing

1. Fork the repository
2. Create a branch (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

<div align="center">

**Made with ❤️ by [Valerii Kovalskii](https://github.com/vakovalskii)**

Based on [DevAgentForge/Claude-Cowork](https://github.com/DevAgentForge/Claude-Cowork)

</div>
