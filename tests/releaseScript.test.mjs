import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('package scripts expose full check and release packaging commands', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(packageJson.scripts.check, 'npm test && npm run build');
  assert.equal(packageJson.scripts.release, 'npm run build && node scripts/package-release.mjs');
});

test('release packaging script zips dist into a versioned artifact', async () => {
  const script = await readFile('scripts/package-release.mjs', 'utf8');

  assert.match(script, /snacktape-v\$\{pkg\.version\}\.zip/);
  assert.match(script, /cwd: 'dist'/);
  assert.match(script, /'zip'/);
  assert.match(script, /console\.log\(`Created \$\{artifactPath\}`\)/);
});
