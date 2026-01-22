#!/usr/bin/env node
const { spawnSync } = require('child_process');

// Wait 5 seconds before starting electron
setTimeout(() => {
  // Run transpile:electron
  const transpileResult = spawnSync('npm', ['run', 'transpile:electron'], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (transpileResult.status !== 0) {
    process.exit(transpileResult.status || 1);
    return;
  }

  // Run electron
  const electronResult = spawnSync(
    'electron',
    ['.', '--no-sandbox'],
    {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
      shell: process.platform === 'win32'
    }
  );

  process.exit(electronResult.status || 0);
}, 5000);

// Keep process alive
process.stdin.resume();
