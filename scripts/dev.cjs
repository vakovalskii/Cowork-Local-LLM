#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';

// Run cleanup on all platforms
spawnSync('npm', ['run', 'dev:clean'], { 
  stdio: 'inherit', 
  shell: isWindows 
});

// Use delayed electron on all platforms for consistency
const electronCommand = 'npm run dev:electron:delayed';

const args = [
  '-k',
  '--kill-others-on-fail',
  '-n',
  'react,electron',
  '-c',
  'cyan,magenta',
  'npm run dev:react',
  electronCommand
];

const proc = spawn('concurrently', args, { 
  stdio: 'inherit', 
  shell: isWindows 
});

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    proc.kill(signal);
  });
});

proc.on('exit', (code) => {
  process.exit(code ?? 0);
});
