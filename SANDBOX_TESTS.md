# 🧪 Sandbox Security Tests

## Как проверить что ExecuteJS действительно изолирован

### ✅ Тест 1: Попытка выйти за пределы workspace

```javascript
// Запустите в приложении:
ExecuteJS({
  explanation: "Test escaping workspace via path traversal",
  code: `
    const fs = require('fs');
    
    // Попытка 1: Относительный путь вверх
    try {
      const content = fs.readFileSync('../../secret.txt', 'utf8');
      console.log('FAIL: Accessed parent directory!', content);
      return { status: 'FAIL', message: 'Escaped workspace!' };
    } catch (err) {
      console.log('PASS: Blocked parent directory access');
    }
    
    // Попытка 2: Абсолютный путь Windows
    try {
      const content = fs.readFileSync('C:\\Windows\\System32\\drivers\\etc\\hosts', 'utf8');
      console.log('FAIL: Accessed system files!', content);
      return { status: 'FAIL', message: 'Accessed system files!' };
    } catch (err) {
      console.log('PASS: Blocked system files access');
    }
    
    // Попытка 3: Абсолютный путь другой диск
    try {
      const content = fs.readFileSync('D:\\secrets.txt', 'utf8');
      console.log('FAIL: Accessed other drive!', content);
      return { status: 'FAIL', message: 'Accessed other drive!' };
    } catch (err) {
      console.log('PASS: Blocked other drive access');
    }
    
    return { status: 'PASS', message: 'All path traversal attempts blocked!' };
  `
})
```

**Ожидаемый результат:** Все попытки должны быть заблокированы

---

### ✅ Тест 2: Попытка использовать опасные Node.js модули

```javascript
ExecuteJS({
  explanation: "Test dangerous Node.js modules access",
  code: `
    const results = [];
    
    // Попытка 1: child_process
    try {
      const child_process = require('child_process');
      child_process.execSync('whoami');
      results.push('FAIL: child_process accessible');
    } catch (err) {
      results.push('PASS: child_process blocked - ' + err.message);
    }
    
    // Попытка 2: os module
    try {
      const os = require('os');
      const homeDir = os.homedir();
      results.push('FAIL: os module accessible, home: ' + homeDir);
    } catch (err) {
      results.push('PASS: os module blocked - ' + err.message);
    }
    
    // Попытка 3: process
    try {
      const cwd = process.cwd();
      results.push('FAIL: process accessible, cwd: ' + cwd);
    } catch (err) {
      results.push('PASS: process blocked - ' + err.message);
    }
    
    // Попытка 4: eval
    try {
      const result = eval('1 + 1');
      results.push('FAIL: eval accessible');
    } catch (err) {
      results.push('PASS: eval blocked - ' + err.message);
    }
    
    console.log(results.join('\\n'));
    return { tests: results };
  `
})
```

**Ожидаемый результат:** `child_process`, `os`, `process` должны быть недоступны

---

### ✅ Тест 3: Проверка что разрешенные модули работают

```javascript
ExecuteJS({
  explanation: "Test allowed modules work correctly",
  code: `
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    const results = [];
    
    // Тест fs
    try {
      fs.writeFileSync('test-safe.txt', 'Hello from sandbox!');
      const content = fs.readFileSync('test-safe.txt', 'utf8');
      fs.unlinkSync('test-safe.txt');
      results.push('PASS: fs module works within workspace');
    } catch (err) {
      results.push('FAIL: fs module error - ' + err.message);
    }
    
    // Тест path
    try {
      const joined = path.join(__dirname, 'subdir', 'file.txt');
      results.push('PASS: path module works');
    } catch (err) {
      results.push('FAIL: path module error - ' + err.message);
    }
    
    // Тест crypto
    try {
      const hash = crypto.createHash('sha256').update('test').digest('hex');
      results.push('PASS: crypto module works, hash: ' + hash.substring(0, 10) + '...');
    } catch (err) {
      results.push('FAIL: crypto module error - ' + err.message);
    }
    
    // Тест __dirname
    try {
      console.log('Workspace __dirname:', __dirname);
      results.push('PASS: __dirname available: ' + __dirname);
    } catch (err) {
      results.push('FAIL: __dirname error - ' + err.message);
    }
    
    return { tests: results };
  `
})
```

**Ожидаемый результат:** Все разрешенные модули должны работать

---

### ✅ Тест 4: Символические ссылки (symlink escape)

```bash
# Сначала создайте symlink в workspace (в PowerShell):
cd C:\Users\user\Desktop\cowork-test
New-Item -ItemType SymbolicLink -Path "evil_link" -Target "C:\Windows"
```

```javascript
ExecuteJS({
  explanation: "Test symlink escape prevention",
  code: `
    const fs = require('fs');
    
    try {
      // Попытка прочитать через symlink
      const content = fs.readFileSync('evil_link/System32/drivers/etc/hosts', 'utf8');
      console.log('FAIL: Symlink escape worked!', content.substring(0, 50));
      return { status: 'FAIL', message: 'Symlink escape successful!' };
    } catch (err) {
      console.log('PASS: Symlink escape blocked');
      return { status: 'PASS', message: 'Symlink blocked: ' + err.message };
    }
  `
})
```

**Ожидаемый результат:** Доступ через symlink должен быть заблокирован

---

### ✅ Тест 5: Проверка изоляции установленных пакетов

```javascript
// Сначала установите тестовый пакет
InstallPackage({ packages: ['lodash'] })

// Потом проверьте что он доступен только в sandbox
ExecuteJS({
  explanation: "Test package isolation",
  code: `
    const _ = require('lodash');
    const path = require('path');
    
    // Проверим откуда загружен пакет
    const lodashPath = require.resolve('lodash');
    console.log('Lodash loaded from:', lodashPath);
    
    // Проверим что это из .cowork-sandbox
    if (lodashPath.includes('.cowork-sandbox')) {
      console.log('PASS: Package loaded from sandbox');
      return { 
        status: 'PASS', 
        message: 'Package isolated in .cowork-sandbox',
        path: lodashPath
      };
    } else {
      console.log('FAIL: Package loaded from global location');
      return { 
        status: 'FAIL', 
        message: 'Package NOT isolated!',
        path: lodashPath
      };
    }
  `
})
```

**Ожидаемый результат:** Пакет должен загружаться из `.cowork-sandbox/node_modules`

---

### ✅ Тест 6: Timeout и бесконечные циклы

```javascript
ExecuteJS({
  explanation: "Test infinite loop protection",
  timeout: 2000, // 2 секунды
  code: `
    console.log('Starting infinite loop test...');
    
    const start = Date.now();
    let iterations = 0;
    
    while (true) {
      iterations++;
      if (iterations % 1000000 === 0) {
        console.log('Iterations:', iterations);
      }
    }
    
    // Не должно дойти сюда
    return { status: 'FAIL', message: 'Loop completed?!' };
  `
})
```

**Ожидаемый результат:** Выполнение должно прерваться по timeout

---

### ✅ Тест 7: Memory/Resource limits

```javascript
ExecuteJS({
  explanation: "Test memory allocation",
  code: `
    console.log('Testing memory allocation...');
    
    const arrays = [];
    let totalSize = 0;
    
    try {
      // Попытка выделить много памяти
      for (let i = 0; i < 100; i++) {
        const arr = new Array(10000000).fill(0); // 10MB per array
        arrays.push(arr);
        totalSize += arr.length;
        console.log('Allocated:', (totalSize * 8 / 1024 / 1024).toFixed(2), 'MB');
      }
      
      return { 
        status: 'WARNING', 
        message: 'Allocated ' + (totalSize * 8 / 1024 / 1024).toFixed(2) + ' MB'
      };
    } catch (err) {
      return { 
        status: 'PASS', 
        message: 'Memory limit reached: ' + err.message 
      };
    }
  `
})
```

**Ожидаемый результат:** Либо timeout, либо ошибка выделения памяти

---

## 🔍 Ручная проверка

### **1. Проверить что .cowork-sandbox изолирован:**

```powershell
# В workspace folder должна быть только эта папка
ls C:\Users\user\Desktop\cowork-test\.cowork-sandbox\

# Проверить что пакеты только здесь
ls C:\Users\user\Desktop\cowork-test\.cowork-sandbox\node_modules\
```

### **2. Проверить логи безопасности:**

```powershell
# Запустить приложение и смотреть терминал
# Должны быть логи типа:
# [Security] Blocked access to path outside working directory:
#   Requested: ../../secret.txt
#   Resolved: C:\Users\user\secret.txt
#   Working dir: C:\Users\user\Desktop\cowork-test
```

### **3. Проверить что нет доступа к process.env:**

```javascript
ExecuteJS({
  code: `
    try {
      const env = process.env;
      console.log('FAIL: Environment variables accessible!');
      console.log('PATH:', env.PATH);
      return { status: 'FAIL' };
    } catch (err) {
      console.log('PASS: process.env blocked');
      return { status: 'PASS' };
    }
  `
})
```

---

## 📊 Критерии успешного теста

| Тест | Критерий успеха |
|------|----------------|
| Path traversal | ❌ Все попытки заблокированы |
| Опасные модули | ❌ child_process, os, process недоступны |
| Разрешенные модули | ✅ fs, path, crypto работают |
| Symlink escape | ❌ Заблокирован |
| Package isolation | ✅ Загрузка из .cowork-sandbox |
| Timeout | ⏱️ Прерывается по таймауту |
| Memory limits | 🛑 Ошибка или timeout при большом объеме |

---

## 🚨 Что делать если тест провален?

Если любой из тестов показал **FAIL** - **НЕ ИСПОЛЬЗУЙТЕ** sandbox в production!

Сообщите о проблеме и исправьте код безопасности в `src/electron/libs/tools/execute-js-tool.ts` и `tools-executor.ts`.
