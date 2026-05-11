import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const zip = process.platform === 'win32' ? 'zip.exe' : 'zip';

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

function sanitizeArtifactSegment(value) {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '');
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const artifactDir = resolve('artifacts');

await run(npm, ['run', 'build']);
await run(npm, ['run', 'smoke:dist']);

const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const artifactName = `${sanitizeArtifactSegment(packageJson.name)}-${sanitizeArtifactSegment(manifest.version)}.zip`;
const artifactPath = resolve(artifactDir, artifactName);

await mkdir(artifactDir, { recursive: true });
await rm(artifactPath, { force: true });

await run(zip, ['-r', artifactPath, '.'], { cwd: 'dist' });

console.log(`Release artifact: ${artifactPath}`);
