import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getBuildInfo() {
  let commit = 'unknown';
  let commitShort = 'unknown';

  try {
    commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    commitShort = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.warn('Warning: Could not get git commit info:', error.message);
  }

  // Read version from package.json
  const packageJson = JSON.parse(
    execSync('cat package.json', { encoding: 'utf-8' })
  );

  return {
    version: packageJson.version,
    commit,
    commitShort,
    buildTime: new Date().toISOString()
  };
}

const buildInfo = getBuildInfo();
const outputPath = join(__dirname, '..', 'src', 'electron', 'build-info.json');

writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));
console.log('Build info generated:', buildInfo);
