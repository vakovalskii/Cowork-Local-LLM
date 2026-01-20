# LocalDesk 0.0.6 — Полный контроль без API-ключей

Йоу! Неделя выдалась жаркой

70+ коммитов, первый серьезный контрибьютор и куча киллер-фич которые меняют правила игры

## Что произошло

Пока я чинил баги с Telegram парсингом и TodoPanel, @abhaymundhara (https://github.com/abhaymundhara) принёс подарок — 25 новых тулов без API-ключей

А @ChernovDev (https://t.me/ChernovDev) вообще красавчик — **допиливал софтину прямо внутри её же чата** через Z.AI

Его вклад: интеграция Z.AI (reader + web search), рендеринг markdown таблиц, session-based todos (изоляция между чатами), много-поточные задачи с режимами консенсус/разные модели, отслеживание изменений файлов через git, spell check в Electron, куча UI улучшений

Это именно то как должен развиваться опенсорс — ребята приходят и делают то на что у тебя руки не дошли

## DuckDuckGo Search — БЕЗ КЛЮЧЕЙ

Три тула для поиска через парсинг HTML: `search` (веб), `search_news` (новости), `search_images` (картинки)

Работает из коробки, никаких Tavily и платных API
Для локального запуска это критично — теперь можно поднять агента имея только модель

## Browser Automation — 11 тулов

Агент теперь рулит браузером как человек: открывает страницы, кликает, печатает, скроллит, наводит, ждёт элементы, делает скриншоты и снапшоты DOM, выполняет JS на странице

Зачем? Парсинг SPA, автоматизация форм, тестирование UI

## Git Integration — 11 тулов

Полная работа с git без терминала: status, log, diff, show, branch, checkout, add, commit, push, pull, reset

Агент сам коммитит если разрешите
Я уже так работаю — говорю "залей на гит" и он пушит

## HTTP/Fetch — 3 тула

`fetch` (любые HTTP запросы), `fetch_json` (работа с API), `download` (скачивание файлов)

## Мои фиксы за неделю

**Telegram:** посты теперь берутся с новейших (было наоборот), пофиксил fallthrough баг в executor

**Todos:** больше не теряются между сессиями, не "протекают" из чата в чат, dynamic system prompt — отключенные тулы не показываются модели

**Core:** MIT лицензия, request timeout 5 минут, loop detector для параллельных batch, broadcast статусов на все окна

## Итого

**Было:** 15 тулов
**Стало:** 38 тулов

```
Files:     bash, read, write, edit, search_files, search_text
Docs:      read_document (PDF/DOCX)
Web:       search, search_news, search_images (DuckDuckGo)
HTTP:      fetch, fetch_json, download
Browser:   11 тулов автоматизации
Git:       11 тулов
Sandbox:   execute_js (WASM QuickJS)
Memory:    manage_memory
Planning:  manage_todos
Render:    render_page (Telegram support)
```

## Ссылки

Репо: https://github.com/vakovalskii/LocalDesk
DMG: скоро выложу

## P.S.

Поиск без API-ключей — это прорыв для локального запуска

Теперь реально поднять полноценного агента имея только vLLM/Ollama с моделью, ноль внешних зависимостей, ноль платных подписок

Именно это отличает LocalDesk от Cowork который работает только с Claude за $100/мес

Ставьте звёзды на репо если зашло
