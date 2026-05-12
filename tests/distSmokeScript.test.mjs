import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('build runs a dist smoke check for Chrome load-unpacked files', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(packageJson.scripts['smoke:dist'], 'node scripts/check-dist.mjs');
  assert.match(packageJson.scripts.build, /npm run build:dist/);
  assert.match(packageJson.scripts['build:dist'], /npm run smoke:dist/);

  const smokeScript = await readFile('scripts/check-dist.mjs', 'utf8');
  assert.match(smokeScript, /dist\/manifest\.json/);
  assert.match(smokeScript, /dist\/main\.js/);
  assert.match(smokeScript, /dist\/background\.js/);
  assert.match(smokeScript, /dist\/content\.js/);
});

test('manual QA script covers current product flows', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const script = await readFile('scripts/manual-qa.mjs', 'utf8');

  assert.equal(packageJson.scripts['qa:manual'], 'node scripts/manual-qa.mjs');
  assert.match(script, /Load unpacked extension/);
  assert.match(script, /Edit capture flow/);
  assert.match(script, /Mixtape management/);
  assert.match(script, /Playback/);
  assert.match(script, /connection-lost notice appears with Reconnect and Stop actions/);
  assert.match(script, /Settings and data/);
});

test('release tooling exposes one-command check and zip packaging scripts', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(packageJson.scripts.check, 'npm run clean && npm run test:compiled && npm run build:dist');
  assert.equal(packageJson.scripts.test, 'npm run clean && npm run test:compiled');
  assert.equal(packageJson.scripts.build, 'npm run clean && npm run build:dist');
  assert.equal(packageJson.scripts['package:release'], 'npm run check && node scripts/package-release.mjs');

  const packageScript = await readFile('scripts/package-release.mjs', 'utf8');
  assert.match(packageScript, /dist/);
  assert.match(packageScript, /artifacts/);
  assert.doesNotMatch(packageScript, /node:child_process/);
  assert.match(packageScript, /Release artifact:/);
});
