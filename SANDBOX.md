# 🔒 Sandbox Security & Package Management

## Overview

The application provides an isolated JavaScript execution environment using two powerful tools:

- **ExecuteJS**: Execute JavaScript code in a secure sandbox
- **InstallPackage**: Install npm packages for use in the sandbox

## How It Works

### 1. Package Installation

When you use `InstallPackage`, packages are installed in a session-specific directory:

```
workspace-folder/
  .cowork-sandbox/
    package.json
    node_modules/
      lodash/
      axios/
      ...
```

**Key Features:**
- ✅ Fully isolated from host system
- ✅ Packages installed per workspace
- ✅ Safe to install any npm package
- ✅ No impact on global environment

### 2. Code Execution

The `ExecuteJS` tool runs code in an isolated Node.js VM context with:

**Built-in APIs:**
```javascript
// File operations (workspace-restricted)
fs.readFile(path)
fs.writeFile(path, content)
fs.exists(path)
fs.listDir(path)

// Path utilities
path.join(...paths)
path.resolve(...paths)

// Standard JavaScript
console.log/error/warn
JSON.parse/stringify
Math.*
Date
__dirname // workspace path
```

**Package Support:**
```javascript
// Built-in Node.js modules (safe subset)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const url = require('url');

// Installed npm packages
const _ = require('lodash');
const axios = require('axios');
```

## Example Usage

### Installing Packages

```javascript
// Install one package
InstallPackage({
  explanation: "Need lodash for data transformation",
  packages: ["lodash"]
})

// Install multiple packages
InstallPackage({
  explanation: "Need date and HTTP utilities",
  packages: ["date-fns", "axios", "cheerio"]
})

// Install specific version
InstallPackage({
  explanation: "Need older version of moment",
  packages: ["moment@2.29.1"]
})
```

### Using Packages in ExecuteJS

```javascript
ExecuteJS({
  explanation: "Process data with lodash",
  code: `
    const _ = require('lodash');
    
    const data = fs.readFile('data.json');
    const parsed = JSON.parse(data);
    
    const grouped = _.groupBy(parsed, 'category');
    const sorted = _.sortBy(grouped, 'name');
    
    fs.writeFile('output.json', JSON.stringify(sorted, null, 2));
    
    console.log('Processed', parsed.length, 'items');
  `
})
```

### Complex Example

```javascript
// 1. Install packages
InstallPackage({
  packages: ["axios", "cheerio"]
})

// 2. Use them to scrape and process data
ExecuteJS({
  code: `
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    async function scrapeAndSave() {
      const response = await axios.get('https://example.com');
      const $ = cheerio.load(response.data);
      
      const items = [];
      $('h2').each((i, el) => {
        items.push($(el).text());
      });
      
      fs.writeFile('scraped.json', JSON.stringify(items, null, 2));
      console.log('Scraped', items.length, 'items');
    }
    
    return scrapeAndSave();
  `
})
```

## Security

### Isolation Guarantees

1. **File System**: Only workspace folder accessible
2. **Network**: Depends on installed packages (e.g., axios can make HTTP requests)
3. **Process**: Cannot spawn system processes
4. **Modules**: Cannot access Node.js internals beyond allowed list

### What's Blocked

```javascript
// ❌ System access
const child_process = require('child_process');
const os = require('os');
const process = require('process');

// ❌ File access outside workspace
fs.readFile('/etc/passwd')
fs.readFile('C:\\Windows\\System32\\...')

// ❌ Dangerous operations
eval() // blocked by VM
new Function() // blocked by VM
```

### Safe Operations

```javascript
// ✅ Workspace file operations
fs.readFile('./file.txt')
fs.writeFile('output.json', data)

// ✅ Data processing
JSON.parse(data)
_.map(items, transform)

// ✅ HTTP requests (with packages)
axios.get('https://api.example.com')

// ✅ Calculations
Math.random()
Date.now()
```

## Technical Details

### VM Context

The sandbox uses Node.js `vm` module with:
- **Timeout**: 5-30 seconds (configurable)
- **Context**: Isolated global scope
- **Memory**: Shared with host process
- **CPU**: No limits (timeout only)

### Package Resolution

```javascript
require('moduleName') // Resolution order:
1. Check if allowed built-in (path, crypto, util, url, ...)
2. Look in .cowork-sandbox/node_modules/moduleName
3. Throw error with installation instructions
```

### Cleanup

The `.cowork-sandbox` directory:
- Created per workspace folder
- Persists between sessions
- Can be safely deleted to reset
- Excluded from git (.gitignore)

## Best Practices

1. **Install once, use many times**: Installed packages persist
2. **Prefer ExecuteJS for complex tasks**: Faster than multiple tool calls
3. **Use built-ins when possible**: No installation needed
4. **Handle async operations**: Use promises/async-await
5. **Check package size**: Large packages take time to install

## Troubleshooting

### "Module not found"
```
Error: Module 'lodash' is not available.
To install it, use the InstallPackage tool first
```
**Solution**: Use `InstallPackage` before requiring the module

### "No workspace folder"
```
Error: Cannot install packages: No workspace folder is set
```
**Solution**: Start a new chat with a workspace folder selected

### "npm not found"
```
Error: Failed to install packages: npm not found
```
**Solution**: Install Node.js/npm on your system

### Installation timeout
```
Error: Command timed out after 120000ms
```
**Solution**: Large packages may fail. Try smaller/faster alternatives.

## Limitations

1. **Installation time**: Large packages (webpack, tensorflow) can be slow
2. **Native modules**: May not work (node-gyp compilation)
3. **Peer dependencies**: Not automatically installed
4. **Version conflicts**: Single version per package in workspace
5. **Memory**: Large data processing may hit limits

## Future Enhancements

- [ ] Package cache across workspaces
- [ ] Native module compilation support
- [ ] Memory/CPU limits per execution
- [ ] Package size warnings
- [ ] Pre-installed common libraries
