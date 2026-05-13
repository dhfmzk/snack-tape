import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const releaseDir = 'release';
const archiveName = `snacktape-v${packageJson.version}.zip`;
const archivePath = resolve(releaseDir, archiveName);

await mkdir(releaseDir, { recursive: true });
await rm(archivePath, { force: true });
await run('zip', ['-r', '-q', archivePath, '.'], { cwd: 'dist' });

console.log(`Created ${releaseDir}/${archiveName}`);
