# ASR Implementations & Optimizations

Текущая реализация обработки голоса .

## 1. Архитектура (Sidecar)
- **Бинарник**: `asr-sidecar` (Swift), запускается дочерним процессом из Tauri.
- **IPC**: `stdin`/`stdout` (NDJSON).
- **Audio Capture**: `AVAudioEngine` -> Converter -> 16kHz Mono Float32.
- **Файл**: `Entry.swift` (Main Loop).

## 2. VAD (Voice Activity Detection)
- **Модель**: Silero VAD v6 (CoreML).
- **Логика**: Анализ чанками по 256мс.
- **Pre-roll Buffer**: 0.5 сек (защита от съедания первых букв).
- **Hard Cut**: Если тишина > 0.6 сек — принудительная финализация фразы и очистка буфера.
- **Файлы**: `VAD.swift`, `Entry.swift` (блока "VAD State").

## 3. Распознавание (Sliding Window)
- **Окно**: Максимум 6 секунд.
- **Шаг**: Инференс каждые 0.5 сек (таймер).
- **Модель**: Parakeet TDT v3 (~0.6B params, ANE).
- **Файл**: `Entry.swift` (Timer logic).

## 4. Stitching V3 (Алгоритм Склейки)
Алгоритм для бесшовного соединения стриминговых чанков.

### Основные механизмы:
1.  **Right-Most Pivot**: Поиск перекрытия конца Committed текста и начала Candidate.
2.  **Fuzzy Matching**: Допускается ~25-30% расхождений (расстояние Левенштейна). Лечит проблему "изменяющихся окончаний/слов" при перераспознавании.
3.  **Capitalization Fix**: Принудительное понижение регистра, если склейка внутри предложения.

- **Файл**: `Stitcher.swift`
- **Функция**: `Stitcher.merge(committed:candidate:)`

## 5. Recent Tweaks (Анти-Галлюцинации & Дедупликация)

Оптимизации для устранения мусора в начале и повторов в конце.

### A. Warm-up Buffer (Start)
**Проблема**: Модель галлюцинирует ("Thank you", "Subtitles") на шуме вдоха или первых миллисекундах звука.
**Решение**:
1.  **Buffering**: Не отправлять аудио в модель, пока буфер меньше **0.8 секунды** (`12800` сэмплов). Это дает модели достаточно контекста для определения языка (ru).
2.  **Sanity Check (Anti-Hallucination)**: Проверка первого результата фразы через черный список и длину.
    - Игнорируются: "Thank you", "MBC", "Copyright" и т.д.
    - Игнорируются слишком короткие огрызки (если не проходят проверку).

- **Где**: `Entry.swift` (Inference Timer block)
- **Код**:
    ```swift
    // Entry.swift: ~line 1121
    if buffer.count < 12800 { return } // 0.8s wait
    ```
    ```swift
    // Stitcher.swift
    static func isSanityCheckPassed(_ text: String) -> Bool
    ```

### B. Finalization with Fuzzy Deduplication (End)
**Проблема**: "Trailing Duplicate" — повтор последних слов после паузы (напр. "надо сделать. надо сделать.").
**Решение**:
В момент `Hard Cut` (тишина > 0.6с):
1.  **Stop Timer**: Игнорирование таймера скользящего окна.
2.  **Sync Finalize**: Запуск синхронного распознавания всего остатка буфера.
3.  **Fuzzy Suffix Check**: Перед добавлением финального текста проверяется, не является ли он (или его часть) уже концом `committedText`.
    - Используется `fuzzyEndsWith` (нормализация + hasSuffix).
    - Если дубль найден — он отбрасывается.

- **Где**: `Entry.swift` (Hard Cut Logic block)
- **Код**:
    ```swift
    // Entry.swift: ~line 1084
    if !Stitcher.fuzzyEndsWith(text: committedText, suffix: candidate) {
        // Merge...
    } else {
        emitLog("Skipped duplicate suffix")
    }
    ```
    ```swift
    // Stitcher.swift
    static func fuzzyEndsWith(text: String, suffix: String) -> Bool
    ```
