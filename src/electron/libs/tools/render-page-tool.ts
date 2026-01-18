/**
 * render_page Tool - Render web pages using Electron's built-in Chromium
 * Perfect for JavaScript-heavy pages that Tavily/Z.AI can't extract properly
 */

import { BrowserWindow, BrowserView } from 'electron';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';

export const RenderPageToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "render_page",
    description: `Render a web page using built-in Chromium browser and extract content.
Perfect for JavaScript-rendered pages (SPAs, React, Vue) that regular extractors can't handle.

**When to use:**
- Page content is loaded via JavaScript
- Regular search_web/extract_page returns empty or incomplete content
- Need to see what a real browser sees

**Returns:** Extracted text content from the rendered page.`,
    parameters: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description: "Why you need to render this page"
        },
        url: {
          type: "string",
          description: "URL to render (must start with http:// or https://)"
        },
        wait_ms: {
          type: "number",
          description: "Extra time to wait after page load for JS to execute (default: 2000ms, max: 10000ms)",
          minimum: 0,
          maximum: 10000
        },
        selector: {
          type: "string",
          description: "Optional CSS selector to extract specific element (e.g., 'main', '#content', '.article')"
        }
      },
      required: ["explanation", "url"]
    }
  }
};

// Hidden browser view for rendering
let renderView: BrowserView | null = null;

/**
 * Get or create the hidden BrowserView for rendering
 */
function getRenderView(): BrowserView {
  if (!renderView) {
    renderView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        javascript: true,
        images: true,
        webSecurity: true
      }
    });
  }
  return renderView;
}

/**
 * Execute render_page tool
 */
export async function executeRenderPageTool(
  args: { url: string; explanation: string; wait_ms?: number; selector?: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const { url, wait_ms = 2000, selector } = args;
  
  // Validate URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      success: false,
      error: '❌ Invalid URL: must start with http:// or https://'
    };
  }
  
  // Limit wait time
  const waitTime = Math.min(wait_ms, 10000);
  
  console.log(`[render_page] Loading: ${url}`);
  console.log(`[render_page] Wait time: ${waitTime}ms`);
  if (selector) {
    console.log(`[render_page] Selector: ${selector}`);
  }
  
  try {
    const view = getRenderView();
    
    // Attach to main window temporarily (required for rendering)
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      return {
        success: false,
        error: '❌ No main window available for rendering'
      };
    }
    
    // Add view but keep it hidden (zero size)
    mainWindow.addBrowserView(view);
    view.setBounds({ x: 0, y: 0, width: 1280, height: 800 });
    view.setAutoResize({ width: false, height: false });
    
    // Load URL with timeout
    const loadPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Page load timeout (30s)'));
      }, 30000);
      
      view.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      view.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load page: ${errorDescription} (${errorCode})`));
      });
    });
    
    await view.webContents.loadURL(url);
    await loadPromise;
    
    console.log(`[render_page] Page loaded, waiting ${waitTime}ms for JS execution...`);
    
    // Wait for JS to execute
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Extract content
    let extractScript: string;
    if (selector) {
      extractScript = `
        (function() {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!el) return { error: 'Selector not found: ${selector}' };
          return {
            text: el.innerText || el.textContent || '',
            html: el.innerHTML.substring(0, 5000),
            tagName: el.tagName
          };
        })()
      `;
    } else {
      extractScript = `
        (function() {
          // Remove scripts, styles, and hidden elements
          const clone = document.body.cloneNode(true);
          clone.querySelectorAll('script, style, noscript, [hidden], [style*="display: none"], [style*="display:none"]').forEach(el => el.remove());
          
          return {
            title: document.title,
            text: clone.innerText || clone.textContent || '',
            url: window.location.href,
            meta: {
              description: document.querySelector('meta[name="description"]')?.content || '',
              keywords: document.querySelector('meta[name="keywords"]')?.content || ''
            }
          };
        })()
      `;
    }
    
    const result = await view.webContents.executeJavaScript(extractScript);
    
    // Remove view from window
    mainWindow.removeBrowserView(view);
    
    // Handle extraction error
    if (result.error) {
      return {
        success: false,
        error: `❌ Extraction failed: ${result.error}`
      };
    }
    
    // Format output
    const textContent = result.text?.trim() || '';
    const charCount = textContent.length;
    
    if (charCount === 0) {
      return {
        success: true,
        output: `⚠️ Page rendered but no text content found.\n\n**URL:** ${url}\n**Title:** ${result.title || 'N/A'}\n\nThe page might be:\n- Mostly images/video\n- Requiring authentication\n- Blocked by CORS/CSP`
      };
    }
    
    // Truncate if too long
    const maxChars = 50000;
    const truncated = charCount > maxChars;
    const displayText = truncated ? textContent.substring(0, maxChars) + '\n\n[... truncated ...]' : textContent;
    
    let output = `✅ **Page rendered successfully**\n\n`;
    output += `**URL:** ${result.url || url}\n`;
    if (result.title) output += `**Title:** ${result.title}\n`;
    output += `**Characters:** ${charCount.toLocaleString()}${truncated ? ' (truncated)' : ''}\n`;
    if (selector) output += `**Selector:** ${selector}\n`;
    
    if (result.meta?.description) {
      output += `**Description:** ${result.meta.description}\n`;
    }
    
    output += `\n---\n**Content:**\n\`\`\`\n${displayText}\n\`\`\``;
    
    console.log(`[render_page] Success: ${charCount} chars extracted`);
    
    return {
      success: true,
      output
    };
    
  } catch (error: any) {
    console.error('[render_page] Error:', error);
    
    return {
      success: false,
      error: `❌ Failed to render page: ${error.message}\n\n**Possible causes:**\n- Invalid URL\n- Network error\n- Page blocked the request\n- JavaScript error on page`
    };
  }
}

/**
 * Cleanup: dispose the BrowserView
 */
export function disposeRenderView(): void {
  if (renderView) {
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.removeBrowserView(renderView);
      }
      // @ts-ignore - destroy exists but not in types
      renderView.webContents?.destroy?.();
    } catch (e) {
      // Ignore cleanup errors
    }
    renderView = null;
  }
}
