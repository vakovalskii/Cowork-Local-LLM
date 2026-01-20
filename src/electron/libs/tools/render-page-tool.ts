/**
 * render_page Tool - Render web pages using Electron's built-in Chromium
 * Perfect for JavaScript-heavy pages that Tavily/Z.AI can't extract properly
 * 
 * Uses hidden BrowserWindow for reliable network connectivity
 * Special support for Telegram: auto-converts t.me → t.me/s and parses reactions/views
 */

import { BrowserWindow } from 'electron';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from './base-tool.js';

export const RenderPageToolDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "render_page",
    description: `Render a web page using built-in Chromium browser and extract content.
Perfect for JavaScript-rendered pages (SPAs, React, Vue) that regular extractors can't handle.

**Special Telegram support:** Automatically converts t.me/channel/123 to web view (t.me/s/channel/123) and extracts post text, reactions, and views.

**When to use:**
- Page content is loaded via JavaScript
- Telegram posts (t.me links) - will auto-convert to web view
- Regular search_web/extract_page returns empty or incomplete content
- Need to see what a real browser sees

**Returns:** Extracted text content. For Telegram: includes reactions and view counts.`,
    parameters: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description: "Why you need to render this page"
        },
        url: {
          type: "string",
          description: "URL to render (must start with http:// or https://). Telegram links are auto-converted."
        },
        wait_ms: {
          type: "number",
          description: "Extra time to wait after page load for JS to execute (default: 2000ms, max: 10000ms)",
          minimum: 0,
          maximum: 10000
        },
        max_posts: {
          type: "number",
          description: "For Telegram: max posts to return (default: 1 if specific post ID in URL, otherwise 5)",
          minimum: 1,
          maximum: 50
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

// Standard Chrome User-Agent to avoid being blocked
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Convert Telegram URL to web view format
 * t.me/channel/123 → t.me/s/channel/123
 * Also extracts specific post ID if present
 */
function convertTelegramUrl(url: string): { url: string; isTelegram: boolean; postId: string | null } {
  try {
    const parsed = new URL(url);
    
    // Check if it's a Telegram URL
    if (parsed.hostname === 't.me' || parsed.hostname === 'telegram.me') {
      const path = parsed.pathname;
      
      // Already in /s/ format - extract post ID
      if (path.startsWith('/s/')) {
        const match = path.match(/^\/s\/([^\/]+)(\/(\d+))?$/);
        const postId = match?.[3] || null;
        return { url, isTelegram: true, postId };
      }
      
      // Convert /channel/post to /s/channel/post
      // Pattern: /channelname or /channelname/123
      const match = path.match(/^\/([^\/]+)(\/(\d+))?$/);
      if (match) {
        const channel = match[1];
        const postIdPart = match[2] || '';
        const postId = match[3] || null;
        const newUrl = `https://t.me/s/${channel}${postIdPart}`;
        console.log(`[render_page] Telegram URL converted: ${url} → ${newUrl}`);
        return { url: newUrl, isTelegram: true, postId };
      }
    }
    
    return { url, isTelegram: false, postId: null };
  } catch {
    return { url, isTelegram: false, postId: null };
  }
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Generate Telegram extraction script
 * If targetPostId is provided, only extract that specific post
 */
function getTelegramExtractScript(targetPostId: string | null, maxPosts: number): string {
  return `
(function() {
  const targetPostId = ${targetPostId ? `'${targetPostId}'` : 'null'};
  const maxPosts = ${maxPosts};
  const posts = [];
  
  // Find all message bubbles and convert to array for reverse iteration
  // Telegram shows old posts at top, new posts at bottom - we want newest first
  const messageBubbles = Array.from(document.querySelectorAll('.tgme_widget_message_wrap')).reverse();
  
  for (const wrap of messageBubbles) {
    // Early exit if we have enough posts
    if (posts.length >= maxPosts) break;
    
    const post = {};
    
    // Post ID from data attribute
    const messageLink = wrap.querySelector('.tgme_widget_message');
    if (messageLink) {
      const href = messageLink.getAttribute('data-post');
      if (href) post.id = href;
    }
    
    // If targeting specific post, skip others
    if (targetPostId && post.id && !post.id.endsWith('/' + targetPostId)) {
      continue;
    }
    
    // Text content - get the MAIN text, not the reply/forward preview
    // Try multiple selectors in order of priority
    let textContent = '';
    
    // 1. Main message text (not inside a reply bubble)
    const mainTextEl = wrap.querySelector('.tgme_widget_message_text.js-message_text');
    if (mainTextEl) {
      textContent = mainTextEl.innerText || mainTextEl.textContent || '';
    }
    
    // 2. Fallback to any message text
    if (!textContent) {
      const textEl = wrap.querySelector('.tgme_widget_message_text');
      if (textEl) {
        textContent = textEl.innerText || textEl.textContent || '';
      }
    }
    
    // 3. Check for reply/quote - get the text AFTER the reply block
    const replyEl = wrap.querySelector('.tgme_widget_message_reply');
    if (replyEl) {
      // Get all text nodes that are NOT inside the reply
      const bubble = wrap.querySelector('.tgme_widget_message_bubble');
      if (bubble) {
        const allText = bubble.innerText || '';
        const replyText = replyEl.innerText || '';
        // Remove reply text from the beginning if present
        if (allText.startsWith(replyText)) {
          textContent = allText.substring(replyText.length).trim();
        }
      }
    }
    
    if (textContent) {
      post.text = textContent;
    }
    
    // Views
    const viewsEl = wrap.querySelector('.tgme_widget_message_views');
    if (viewsEl) {
      post.views = viewsEl.innerText || '';
    }
    
    // Date/time
    const dateEl = wrap.querySelector('.tgme_widget_message_date time');
    if (dateEl) {
      post.date = dateEl.getAttribute('datetime') || dateEl.innerText || '';
    }
    
    // Reactions
    const reactions = [];
    const reactionEls = wrap.querySelectorAll('.tgme_widget_message_reaction');
    reactionEls.forEach(r => {
      const emoji = r.querySelector('.tgme_widget_message_reaction_emoji, i')?.innerText || 
                    r.querySelector('i')?.className?.match(/emoji-([^\\\\s]+)/)?.[1] || '?';
      const count = r.querySelector('.tgme_widget_message_reaction_count')?.innerText || 
                    r.innerText?.match(/\\\\d+/)?.[0] || '0';
      reactions.push({ emoji: emoji.trim(), count: count.trim() });
    });
    if (reactions.length > 0) {
      post.reactions = reactions;
    }
    
    // Media (photos, videos)
    const photos = wrap.querySelectorAll('.tgme_widget_message_photo_wrap');
    const videos = wrap.querySelectorAll('.tgme_widget_message_video');
    if (photos.length > 0) post.hasPhotos = photos.length;
    if (videos.length > 0) post.hasVideos = videos.length;
    
    // Forward info
    const forwardEl = wrap.querySelector('.tgme_widget_message_forwarded_from');
    if (forwardEl) {
      post.forwardedFrom = forwardEl.innerText || '';
    }
    
    // Author (for channels with multiple authors)
    const authorEl = wrap.querySelector('.tgme_widget_message_from_author');
    if (authorEl) {
      post.author = authorEl.innerText || '';
    }
    
    if (post.text || post.hasPhotos || post.hasVideos) {
      posts.push(post);
      
      // If targeting specific post and found it, stop
      if (targetPostId && post.id?.endsWith('/' + targetPostId)) {
        break;
      }
    }
  }
  
  // Channel info
  const channelInfo = {};
  const titleEl = document.querySelector('.tgme_channel_info_header_title');
  if (titleEl) channelInfo.title = titleEl.innerText || '';
  
  const subsEl = document.querySelector('.tgme_channel_info_counter .counter_value');
  if (subsEl) channelInfo.subscribers = subsEl.innerText || '';
  
  const descEl = document.querySelector('.tgme_channel_info_description');
  if (descEl) channelInfo.description = descEl.innerText || '';
  
  return {
    telegram: true,
    channel: channelInfo,
    posts: posts,
    url: window.location.href,
    targetPostId: targetPostId
  };
})()
`;
}

/**
 * Format Telegram extraction result
 */
function formatTelegramResult(result: any, targetPostId: string | null): string {
  const isSinglePost = result.posts?.length === 1 && targetPostId;
  
  let output = `📱 **Telegram`;
  if (isSinglePost) {
    output += ` Post**\n\n`;
  } else {
    output += ` Channel**\n\n`;
  }
  
  if (result.channel?.title) {
    output += `**Channel:** ${result.channel.title}\n`;
  }
  if (result.channel?.subscribers && !isSinglePost) {
    output += `**Subscribers:** ${result.channel.subscribers}\n`;
  }
  
  output += `**URL:** ${result.url}\n`;
  
  if (!isSinglePost) {
    output += `**Posts:** ${result.posts?.length || 0}\n`;
  }
  output += `\n---\n\n`;
  
  if (result.posts && result.posts.length > 0) {
    result.posts.forEach((post: any, i: number) => {
      // For single post, don't show "Post 1" header
      if (!isSinglePost) {
        output += `### Post ${i + 1}`;
        if (post.id) output += ` (${post.id})`;
        output += `\n`;
      }
      
      if (post.date) output += `📅 ${post.date}\n`;
      if (post.views) output += `👁 **${post.views}** views\n`;
      if (post.author) output += `✍️ ${post.author}\n`;
      if (post.forwardedFrom) output += `↩️ Forwarded from: ${post.forwardedFrom}\n`;
      
      // Reactions
      if (post.reactions && post.reactions.length > 0) {
        const reactionsStr = post.reactions
          .map((r: any) => `${r.emoji} ${r.count}`)
          .join(' | ');
        output += `💬 **Reactions:** ${reactionsStr}\n`;
      }
      
      // Media
      if (post.hasPhotos) output += `🖼 Photos: ${post.hasPhotos}\n`;
      if (post.hasVideos) output += `🎬 Videos: ${post.hasVideos}\n`;
      
      output += `\n`;
      
      // Post text
      if (post.text) {
        output += `${post.text}\n`;
      } else {
        output += `[Media only post]\n`;
      }
      
      if (!isSinglePost && i < result.posts.length - 1) {
        output += `\n---\n\n`;
      }
    });
  } else {
    output += `⚠️ No posts found. The channel might be private or the URL incorrect.\n`;
  }
  
  return output;
}

/**
 * Execute render_page tool
 */
export async function executeRenderPageTool(
  args: { url: string; explanation: string; wait_ms?: number; max_posts?: number; selector?: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  let { url, wait_ms = 2000, max_posts, selector } = args;
  
  // Validate URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      success: false,
      error: '❌ Invalid URL: must start with http:// or https://'
    };
  }
  
  // Check and convert Telegram URLs
  const { url: finalUrl, isTelegram, postId: targetPostId } = convertTelegramUrl(url);
  url = finalUrl;
  
  // Smart default for max_posts: 1 if specific post requested, 5 otherwise
  const effectiveMaxPosts = max_posts ?? (targetPostId ? 1 : 5);
  
  // Telegram needs more time for JS rendering
  const waitTime = Math.min(isTelegram ? Math.max(wait_ms, 3000) : wait_ms, 10000);
  
  console.log(`[render_page] Loading: ${url}`);
  console.log(`[render_page] Wait time: ${waitTime}ms`);
  console.log(`[render_page] Telegram mode: ${isTelegram}`);
  if (isTelegram) {
    console.log(`[render_page] Target post ID: ${targetPostId || 'none (latest posts)'}`);
    console.log(`[render_page] Max posts: ${effectiveMaxPosts}`);
  }
  if (selector) {
    console.log(`[render_page] Selector: ${selector}`);
  }
  
  let renderWindow: BrowserWindow | null = null;
  let lastError: Error | null = null;
  
  // Retry loop for SSL/network errors
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create a hidden window for rendering
      renderWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,  // Hidden from user
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          javascript: true,
          images: true,
          webSecurity: true,
          allowRunningInsecureContent: false
        }
      });
      
      // Set User-Agent
      renderWindow.webContents.setUserAgent(USER_AGENT);
      
      // Set up load promise BEFORE loading URL
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Page load timeout (30s)'));
        }, 30000);
        
        renderWindow!.webContents.once('did-finish-load', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        renderWindow!.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
          clearTimeout(timeout);
          reject(new Error(`${errorDescription} (${errorCode})`));
        });
      });
      
      // Load the URL
      renderWindow.loadURL(url, {
        userAgent: USER_AGENT,
        httpReferrer: 'https://www.google.com/'
      });
      
      await loadPromise;
      
      // Success - break retry loop
      lastError = null;
      break;
      
    } catch (error: any) {
      lastError = error;
      console.log(`[render_page] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
      
      // Cleanup failed window
      if (renderWindow) {
        try { renderWindow.close(); } catch (e) { /* ignore */ }
        renderWindow = null;
      }
      
      // Don't retry on timeout or if max retries reached
      if (error.message.includes('timeout') || attempt >= MAX_RETRIES) {
        break;
      }
      
      // Wait before retry
      console.log(`[render_page] Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  
  // If all retries failed
  if (lastError || !renderWindow) {
    return {
      success: false,
      error: `❌ Failed to load page after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}\n\n**Possible causes:**\n- Network connectivity issues\n- SSL/TLS handshake problems\n- Site blocking automated requests`
    };
  }
  
  try {
    
    console.log(`[render_page] Page loaded, waiting ${waitTime}ms for JS execution...`);
    
    // Wait for JS to execute
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // For Telegram: scroll to TOP to load older posts
    if (isTelegram && effectiveMaxPosts > 5) {
      console.log(`[render_page] Telegram: scrolling to TOP to load older posts (target: ${effectiveMaxPosts})...`);
      
      // Telegram loads ~14-20 posts initially
      // Scrolling to top (0,0) triggers lazy-loading of ~18 more older posts
      // Each scroll + 2sec wait loads another batch
      const maxIterations = Math.ceil(effectiveMaxPosts / 15); // ~15 posts per scroll
      
      for (let i = 0; i < maxIterations; i++) {
        // Get current post count before scrolling
        const postCountBefore = await renderWindow.webContents.executeJavaScript(`
          document.querySelectorAll('.tgme_widget_message_wrap').length
        `);
        
        console.log(`[render_page] Telegram scroll ${i + 1}/${maxIterations}, posts: ${postCountBefore}`);
        
        // Already have enough posts?
        if (postCountBefore >= effectiveMaxPosts) {
          console.log(`[render_page] Got enough posts (${postCountBefore}), stopping scroll`);
          break;
        }
        
        // Scroll to the very TOP to trigger loading older posts
        await renderWindow.webContents.executeJavaScript(`
          window.scrollTo(0, 0);
        `);
        
        // Wait 2 seconds for Telegram to load older posts
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if new posts were loaded
        const postCountAfter = await renderWindow.webContents.executeJavaScript(`
          document.querySelectorAll('.tgme_widget_message_wrap').length
        `);
        
        console.log(`[render_page] After scroll: ${postCountAfter} posts`);
        
        // If no new posts loaded after first iteration, we've reached the beginning
        if (postCountAfter === postCountBefore && i > 0) {
          console.log(`[render_page] No new posts loaded, reached channel beginning`);
          break;
        }
      }
    }
    
    // Choose extraction script based on URL type
    let extractScript: string;
    
    if (isTelegram && !selector) {
      // Use special Telegram parser with filtering built-in
      extractScript = getTelegramExtractScript(targetPostId, effectiveMaxPosts);
    } else if (selector) {
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
    
    const result = await renderWindow.webContents.executeJavaScript(extractScript);
    
    // Close the hidden window
    renderWindow.close();
    renderWindow = null;
    
    // Handle extraction error
    if (result.error) {
      return {
        success: false,
        error: `❌ Extraction failed: ${result.error}`
      };
    }
    
    // Format output based on type
    if (result.telegram) {
      // Posts are already filtered in the extraction script
      const posts = result.posts || [];
      
      // Telegram-specific formatting
      const output = formatTelegramResult(result, targetPostId);
      console.log(`[render_page] Telegram: ${posts.length} post(s) extracted`);
      
      return {
        success: true,
        output
      };
    }
    
    // Standard page formatting
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
    
    // Cleanup on error
    if (renderWindow) {
      try {
        renderWindow.close();
      } catch (e) { /* ignore */ }
    }
    
    return {
      success: false,
      error: `❌ Failed to render page: ${error.message}\n\n**Possible causes:**\n- Invalid URL\n- Network error\n- Page blocked the request\n- JavaScript error on page`
    };
  }
}
