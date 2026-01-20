/**
 * OpenAI-compatible tool definitions for Qwen and other models
 */

import { ALL_TOOL_DEFINITIONS } from './tools/index.js';
import type { ApiSettings } from '../types.js';

// Get tools based on settings
export function getTools(settings: ApiSettings | null) {
  let tools = [...ALL_TOOL_DEFINITIONS];
  
  // Filter out Memory tool if not enabled
  if (!settings?.enableMemory) {
    tools = tools.filter(tool => tool.function.name !== 'manage_memory');
  }
  
  // Filter out ZaiReader if not enabled or Z.AI API key not provided
  const zaiReaderEnabled = settings?.enableZaiReader === true;
  const hasZaiKey = Boolean(settings?.zaiApiKey);
  console.log(`[getTools] enableZaiReader: ${zaiReaderEnabled}, hasZaiKey: ${hasZaiKey}`);
  
  if (!zaiReaderEnabled || !hasZaiKey) {
    tools = tools.filter(tool => tool.function.name !== 'read_page');
  }
  
  console.log(`[getTools] Active tools: ${tools.map(t => t.function.name).join(', ')}`);
  return tools;
}

// Export all tools (for backward compatibility)
export const TOOLS = ALL_TOOL_DEFINITIONS;
