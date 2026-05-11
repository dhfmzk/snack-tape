import { spawn } from 'node:child_process';
import { mkdir, rm, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function assertDistReady() {
  const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
  if (manifest.manifest_version !== 3) {
    throw new Error('dist/manifest.json is not a Chrome MV3 manifest');
  }
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const releaseDir = 'release';
const artifactPath = join(releaseDir, `snacktape-v${pkg.version}.zip`);

await assertDistReady();
await mkdir(releaseDir, { recursive: true });
await rm(artifactPath, { force: true });
await run('zip', ['-qr', `../${artifactPath}`, '.'], { cwd: 'dist' });

const artifact = await stat(artifactPath);
if (!artifact.isFile() || artifact.size === 0) {
  throw new Error(`${artifactPath} was not created`);
}

console.log(`Created ${artifactPath}`);
