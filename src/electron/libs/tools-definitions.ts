/**
 * OpenAI-compatible tool definitions for Qwen and other models
 */

import { ALL_TOOL_DEFINITIONS } from './tools/index.js';
import { getSystemPrompt, SYSTEM_PROMPT } from './prompt-loader.js';
import type { ApiSettings } from '../types.js';

// Get tools based on settings
export function getTools(settings: ApiSettings | null) {
  let tools = ALL_TOOL_DEFINITIONS;
  
  // Filter out Memory tool if not enabled
  if (!settings?.enableMemory) {
    tools = tools.filter(tool => tool.function.name !== 'manage_memory');
  }
  
  // Filter out ZaiReader if not enabled or Z.AI API key not provided
  if (!settings?.enableZaiReader || !settings?.zaiApiKey) {
    tools = tools.filter(tool => tool.function.name !== 'read_page');
  }
  
  return tools;
}

// Export all tools (for backward compatibility)
export const TOOLS = ALL_TOOL_DEFINITIONS;

// Export prompt functions
export { getSystemPrompt, SYSTEM_PROMPT };
