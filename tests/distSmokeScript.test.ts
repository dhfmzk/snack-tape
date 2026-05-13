// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('build runs a dist smoke check for Chrome load-unpacked files', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(packageJson.scripts['smoke:dist'], 'node scripts/check-dist.mjs');
  assert.equal(packageJson.scripts['smoke:chrome'], undefined);
  assert.match(packageJson.scripts.build, /npm run smoke:dist/);

  const smokeScript = await readFile('scripts/check-dist.mjs', 'utf8');
  assert.match(smokeScript, /dist\/manifest\.json/);
  assert.match(smokeScript, /dist\/main\.js/);
  assert.match(smokeScript, /dist\/background\.js/);
  assert.match(smokeScript, /dist\/content\.js/);
  assert.match(smokeScript, /manifest\.icons/);
  assert.match(smokeScript, /manifest\.action\?\.default_icon/);
});

test('GitHub Actions CI runs the full project check', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /npm install --no-package-lock --no-audit --no-fund/);
  assert.match(workflow, /npm run check/);
  assert.doesNotMatch(workflow, /smoke:chrome/);
});
