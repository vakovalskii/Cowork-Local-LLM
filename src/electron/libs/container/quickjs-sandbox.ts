/**
 * QuickJS Sandbox - Secure JS execution using quickjs-emscripten (WASM)
 * Works out of the box - no installation needed
 */

import { getQuickJS } from 'quickjs-emscripten';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname, basename, extname } from 'path';

export interface QuickJSExecuteResult {
  success: boolean;
  output: string;
  error?: string;
  logs: string[];
}

// Cached QuickJS instance
let quickJsModule: Awaited<ReturnType<typeof getQuickJS>> | null = null;

/**
 * Get or create QuickJS module (singleton)
 */
async function getQuickJSModule() {
  if (!quickJsModule) {
    console.log('[QuickJS] Loading WASM module...');
    quickJsModule = await getQuickJS();
    console.log('[QuickJS] WASM module loaded');
  }
  return quickJsModule;
}

/**
 * Execute JavaScript code in QuickJS sandbox
 */
export async function executeInQuickJS(
  code: string,
  cwd: string,
  isPathSafe: (path: string) => boolean,
  timeout: number = 5000
): Promise<QuickJSExecuteResult> {
  const logs: string[] = [];
  
  try {
    console.log('[QuickJS] Starting execution');
    
    const QuickJS = await getQuickJSModule();
    const vm = QuickJS.newContext();
    
    // Setup console
    const consoleHandle = vm.newObject();
    
    const logFn = vm.newFunction('log', (...args) => {
      const parts = args.map(arg => {
        if (arg) {
          const val = vm.dump(arg);
          return typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
        }
        return 'undefined';
      });
      const msg = parts.join(' ');
      logs.push(msg);
      console.log('[QuickJS Sandbox]', msg);
    });
    vm.setProp(consoleHandle, 'log', logFn);
    logFn.dispose();
    
    const errorFn = vm.newFunction('error', (...args) => {
      const parts = args.map(arg => {
        if (arg) {
          const val = vm.dump(arg);
          return typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
        }
        return 'undefined';
      });
      const msg = `ERROR: ${parts.join(' ')}`;
      logs.push(msg);
      console.error('[QuickJS Sandbox]', msg);
    });
    vm.setProp(consoleHandle, 'error', errorFn);
    errorFn.dispose();
    
    const warnFn = vm.newFunction('warn', (...args) => {
      const parts = args.map(arg => {
        if (arg) {
          const val = vm.dump(arg);
          return typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
        }
        return 'undefined';
      });
      const msg = `WARN: ${parts.join(' ')}`;
      logs.push(msg);
      console.warn('[QuickJS Sandbox]', msg);
    });
    vm.setProp(consoleHandle, 'warn', warnFn);
    warnFn.dispose();
    
    vm.setProp(vm.global, 'console', consoleHandle);
    consoleHandle.dispose();
    
    // Setup fs object
    const fsHandle = vm.newObject();
    
    const readFileSyncFn = vm.newFunction('readFileSync', (pathHandle, encodingHandle) => {
      const filePath = vm.getString(pathHandle);
      const fullPath = resolve(cwd, filePath.startsWith('/') ? filePath.slice(1) : filePath);
      
      if (!isPathSafe(fullPath)) {
        throw new Error(`Access denied: ${filePath} is outside workspace`);
      }
      
      try {
        const content = readFileSync(fullPath, 'utf-8');
        return vm.newString(content);
      } catch (e: any) {
        throw new Error(`Cannot read file: ${e.message}`);
      }
    });
    vm.setProp(fsHandle, 'readFileSync', readFileSyncFn);
    readFileSyncFn.dispose();
    
    const writeFileSyncFn = vm.newFunction('writeFileSync', (pathHandle, dataHandle) => {
      const filePath = vm.getString(pathHandle);
      const data = vm.getString(dataHandle);
      const fullPath = resolve(cwd, filePath.startsWith('/') ? filePath.slice(1) : filePath);
      
      if (!isPathSafe(fullPath)) {
        throw new Error(`Access denied: ${filePath} is outside workspace`);
      }
      
      try {
        writeFileSync(fullPath, data, 'utf-8');
        return vm.undefined;
      } catch (e: any) {
        throw new Error(`Cannot write file: ${e.message}`);
      }
    });
    vm.setProp(fsHandle, 'writeFileSync', writeFileSyncFn);
    writeFileSyncFn.dispose();
    
    const existsSyncFn = vm.newFunction('existsSync', (pathHandle) => {
      const filePath = vm.getString(pathHandle);
      const fullPath = resolve(cwd, filePath.startsWith('/') ? filePath.slice(1) : filePath);
      return existsSync(fullPath) ? vm.true : vm.false;
    });
    vm.setProp(fsHandle, 'existsSync', existsSyncFn);
    existsSyncFn.dispose();
    
    const readdirSyncFn = vm.newFunction('readdirSync', (pathHandle) => {
      const dirPath = vm.getString(pathHandle);
      const fullPath = resolve(cwd, dirPath.startsWith('/') ? dirPath.slice(1) : dirPath);
      
      if (!isPathSafe(fullPath)) {
        throw new Error(`Access denied: ${dirPath} is outside workspace`);
      }
      
      try {
        const files = readdirSync(fullPath);
        const arr = vm.newArray();
        files.forEach((file, i) => {
          const str = vm.newString(file);
          vm.setProp(arr, i, str);
          str.dispose();
        });
        return arr;
      } catch (e: any) {
        throw new Error(`Cannot read directory: ${e.message}`);
      }
    });
    vm.setProp(fsHandle, 'readdirSync', readdirSyncFn);
    readdirSyncFn.dispose();
    
    vm.setProp(vm.global, 'fs', fsHandle);
    fsHandle.dispose();
    
    // Setup path object
    const pathHandle = vm.newObject();
    
    const joinFn = vm.newFunction('join', (...args) => {
      const parts = args.map(arg => vm.getString(arg));
      return vm.newString(join(...parts));
    });
    vm.setProp(pathHandle, 'join', joinFn);
    joinFn.dispose();
    
    const resolveFn = vm.newFunction('resolve', (...args) => {
      const parts = args.map(arg => vm.getString(arg));
      return vm.newString(resolve(...parts));
    });
    vm.setProp(pathHandle, 'resolve', resolveFn);
    resolveFn.dispose();
    
    const dirnameFn = vm.newFunction('dirname', (p) => {
      return vm.newString(dirname(vm.getString(p)));
    });
    vm.setProp(pathHandle, 'dirname', dirnameFn);
    dirnameFn.dispose();
    
    const basenameFn = vm.newFunction('basename', (p) => {
      return vm.newString(basename(vm.getString(p)));
    });
    vm.setProp(pathHandle, 'basename', basenameFn);
    basenameFn.dispose();
    
    const extnameFn = vm.newFunction('extname', (p) => {
      return vm.newString(extname(vm.getString(p)));
    });
    vm.setProp(pathHandle, 'extname', extnameFn);
    extnameFn.dispose();
    
    vm.setProp(vm.global, 'path', pathHandle);
    pathHandle.dispose();
    
    // Setup __dirname
    const cwdStr = vm.newString(cwd);
    vm.setProp(vm.global, '__dirname', cwdStr);
    cwdStr.dispose();
    
    // Execute code with timeout
    vm.runtime.setInterruptHandler(() => {
      return false; // Don't interrupt
    });
    
    // Wrap code to capture return value
    const wrappedCode = `
(function() {
${code}
})()
`;
    
    const result = vm.evalCode(wrappedCode);
    
    if (result.error) {
      const errorObj = vm.dump(result.error);
      result.error.dispose();
      vm.dispose();
      
      return {
        success: false,
        output: '',
        error: String(errorObj),
        logs
      };
    }
    
    const value = vm.dump(result.value);
    result.value.dispose();
    vm.dispose();
    
    let outputStr = '';
    if (value !== undefined) {
      outputStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    }
    
    return {
      success: true,
      output: outputStr,
      logs
    };
    
  } catch (error: any) {
    console.error('[QuickJS] Error:', error);
    
    return {
      success: false,
      output: '',
      error: error.message,
      logs
    };
  }
}
