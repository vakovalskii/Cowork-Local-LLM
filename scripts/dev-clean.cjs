#!/usr/bin/env node
const { execSync } = require('child_process');

const platform = process.platform;

try {
  if (platform === 'win32') {
    // Windows: kill processes by name
    // Note: This is a best-effort cleanup and may not catch all vite processes
    // but it's safe and works across all Windows versions
    try {
      // Kill electron processes
      execSync('taskkill /F /IM electron.exe 2>nul', { stdio: 'ignore', shell: true });
    } catch (e) {
      // Ignore errors if process not found
    }
    // For vite, we rely on concurrently to manage the process lifecycle
    // Manual cleanup of vite on Windows is complex and error-prone
  } else {
    // Unix-like (macOS, Linux): use pkill
    try {
      execSync('pkill -f "[v]ite\\b" 2>/dev/null || true', { stdio: 'ignore', shell: true });
    } catch (e) {
      // Ignore errors
    }
    try {
      execSync('pkill -f "[e]lectron\\s+\\." 2>/dev/null || true', { stdio: 'ignore', shell: true });
    } catch (e) {
      // Ignore errors
    }
  }
} catch (e) {
  // Ignore all errors - this is a cleanup script
}
