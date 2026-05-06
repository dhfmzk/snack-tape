import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const shared = {
  format: 'esm',
  target: 'es2022'
};

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit'
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

await mkdir('dist', { recursive: true });

await run(npx, [
  '--yes',
  '--package',
  'esbuild@0.25.12',
  'esbuild',
  'src/background/background.ts',
  'src/content/contentScript.ts',
  'src/popup/popup.ts',
  'src/editor/editor.ts',
  '--bundle',
  `--format=${shared.format}`,
  `--target=${shared.target}`,
  '--platform=browser',
  '--outdir=dist',
  '--entry-names=[name]'
]);

await Promise.all([
  cp('src/popup/popup.html', 'dist/popup.html'),
  cp('src/popup/popup.css', 'dist/popup.css'),
  cp('src/editor/editor.html', 'dist/editor.html'),
  cp('src/editor/editor.css', 'dist/editor.css')
]);

const manifest = await readFile('manifest.json', 'utf8');
await writeFile('dist/manifest.json', manifest);
