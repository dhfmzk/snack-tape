import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('package scripts expose full check and release packaging commands', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(packageJson.scripts.check, 'npm run clean && npm run test:compiled && npm run build:dist');
  assert.equal(packageJson.scripts['package:release'], 'npm run check && node scripts/package-release.mjs');
});

test('release packaging script zips dist into a versioned artifact', async () => {
  const script = await readFile('scripts/package-release.mjs', 'utf8');

  assert.match(script, /sanitizeArtifactSegment/);
  assert.match(script, /artifacts/);
  assert.doesNotMatch(script, /node:child_process/);
  assert.match(script, /Release artifact:/);
});
