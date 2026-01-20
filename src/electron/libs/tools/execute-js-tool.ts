/**
 * ExecuteJS Tool - Execute JavaScript code in secure WASM sandbox (QuickJS)
 * Works out of the box - no installation needed
 */

import { executeInQuickJS } from '../container/quickjs-sandbox.js';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';

export const ExecuteJSToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "execute_js",
    description: `Execute JavaScript code in a secure isolated WASM sandbox (QuickJS engine).
Works out of the box - no installation needed on user's machine.

**AVAILABLE GLOBALS** (no imports needed - just use directly):
- fs.readFileSync(path) - read file content
- fs.writeFileSync(path, data) - write file
- fs.existsSync(path) - check if file exists  
- fs.readdirSync(path) - list directory
- path.join(...), path.resolve(...), path.dirname(), path.basename(), path.extname()
- console.log(), console.error(), console.warn()
- JSON, Math, Date, __dirname

**CODE FORMAT**: Code runs inside (function(){ ... })() wrapper. Use 'return' to output results.

**EXAMPLE**:
const files = fs.readdirSync('/');
const data = fs.readFileSync('/data.json');
const parsed = JSON.parse(data);
console.log('Found', files.length, 'files');
return { count: parsed.items.length };

**LIMITATIONS**: No ES modules (import/export), no TypeScript, no async/await, no fetch, no npm packages.`,
    parameters: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description: "Why you're executing this code and what it should do"
        },
        code: {
          type: "string",
          description: "JavaScript code to execute. Use global fs, path, console directly (no imports). Use 'return' to output values."
        },
        timeout: {
          type: "number",
          description: "Execution timeout in milliseconds (default: 5000, max: 30000)",
          minimum: 100,
          maximum: 30000
        }
      },
      required: ["explanation", "code"]
    }
  }
};

export async function executeJSTool(
  args: { code: string; explanation: string; timeout?: number },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const timeout = Math.min(args.timeout || 5000, 30000);
  
    console.log('[ExecuteJS] Starting execution');
    console.log('[ExecuteJS] Timeout:', timeout);
    console.log('[ExecuteJS] Context CWD:', context.cwd);
    console.log('[ExecuteJS] Code length:', args.code.length);
    
  try {
    const result = await executeInQuickJS(
      args.code,
      context.cwd,
      context.isPathSafe,
      timeout
    );
    
    if (result.success) {
      let output = '✅ Code executed successfully (QuickJS WASM Sandbox)\n\n';
    
      if (result.logs.length > 0) {
        output += '**Console Output:**\n```\n' + result.logs.join('\n') + '\n```\n\n';
    }
    
      if (result.output) {
        output += '**Result:**\n```json\n' + result.output + '\n```';
    }
    
      return { success: true, output };
    } else {
      // Properly stringify error (may be object or string)
      const err = result.error as any;
      const errorText = typeof err === 'string' 
        ? err 
        : (err?.message || JSON.stringify(err, null, 2));
      
      let errorMsg = `❌ Execution failed: ${errorText}\n\n`;
    
      // Show truncated code for debugging
      errorMsg += `**Your code:**\n\`\`\`javascript\n${args.code.substring(0, 500)}${args.code.length > 500 ? '\n// ... truncated ...' : ''}\n\`\`\`\n\n`;
    
      // Add helpful hints based on error
      if (errorText?.includes('not defined') || errorText?.includes('is not a function')) {
        errorMsg += `💡 **Available APIs:**\n`;
        errorMsg += `- **fs**: readFileSync, writeFileSync, existsSync, readdirSync\n`;
        errorMsg += `- **path**: join, resolve, dirname, basename, extname\n`;
        errorMsg += `- **console**: log, error, warn, info\n`;
        errorMsg += `- **Built-in**: JSON, Math, Date, String, Array, Object\n`;
        errorMsg += `- **env**: Environment variables (env.CWD)\n`;
      } else if (errorText?.includes('timeout')) {
        errorMsg += `💡 **Hint**: Code execution timed out. Try:\n`;
        errorMsg += `- Simplifying your code\n`;
        errorMsg += `- Avoiding infinite loops\n`;
        errorMsg += `- Processing less data at once\n`;
      }
      
      if (result.logs.length > 0) {
        errorMsg += `\n**Console output before error:**\n\`\`\`\n${result.logs.join('\n')}\n\`\`\``;
      }
      
      return { success: false, error: errorMsg };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `❌ Sandbox execution failed: ${error.message}`
    };
  }
}
