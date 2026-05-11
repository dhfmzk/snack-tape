import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('build runs a dist smoke check for Chrome load-unpacked files', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(packageJson.scripts['smoke:dist'], 'node scripts/check-dist.mjs');
  assert.match(packageJson.scripts.build, /npm run smoke:dist/);

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
