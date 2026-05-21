// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('release scripts run version verification and dist smoke checks', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(packageJson.scripts['release:verify'], 'node scripts/check-release-versions.mjs');
  assert.equal(packageJson.scripts['smoke:dist'], 'node scripts/check-dist.mjs');
  assert.equal(packageJson.scripts['smoke:chrome'], undefined);
  assert.match(packageJson.scripts.build, /npm run smoke:dist/);
  assert.equal(packageJson.scripts['release:zip'], 'npm run release:verify && npm run build && node scripts/create-release-zip.mjs');
  assert.equal(packageJson.scripts['package:release'], undefined);

  const smokeScript = await readFile('scripts/check-dist.mjs', 'utf8');
  assert.match(smokeScript, /dist\/manifest\.json/);
  assert.match(smokeScript, /dist\/main\.js/);
  assert.match(smokeScript, /dist\/background\.js/);
  assert.match(smokeScript, /dist\/content\.js/);
  assert.match(smokeScript, /manifest\.icons/);
  assert.match(smokeScript, /manifest\.action\?\.default_icon/);

  const releaseScript = await readFile('scripts/create-release-zip.mjs', 'utf8');
  assert.match(releaseScript, /snacktape-v\$\{packageJson\.version\}\.zip/);
  assert.match(releaseScript, /createZipArchive\(DIST_DIR, archivePath\)/);
  assert.match(releaseScript, /writeFile\(archivePath/);
  assert.doesNotMatch(releaseScript, /node:child_process|run\('zip'|spawn\(/);

  const releaseMetadataScript = await readFile('scripts/check-release-versions.mjs', 'utf8');
  assert.match(releaseMetadataScript, /manifest\.version/);
  assert.match(releaseMetadataScript, /packageJson\.version/);
  assert.match(releaseMetadataScript, /versions match/);
});

test('GitHub Actions CI runs the full project check', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /npm install --no-package-lock --no-audit --no-fund/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run release:zip/);
  assert.match(workflow, /unzip -t release\/snacktape-v\*\.zip/);
  assert.doesNotMatch(workflow, /smoke:chrome/);
});
