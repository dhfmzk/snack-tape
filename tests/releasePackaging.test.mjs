import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { buildReleasePackage } from '../scripts/package-release.mjs';

async function writeFixture(root, path, value) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value);
}

test('buildReleasePackage writes a dist zip archive without a system zip binary', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'snacktape-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await writeFixture(root, 'package.json', JSON.stringify({ name: '@local/Snack Tape' }));
  await writeFixture(root, 'dist/manifest.json', JSON.stringify({
    manifest_version: 3,
    version: '1.2.3'
  }));
  await writeFixture(root, 'dist/main.js', 'console.log("main");');
  await writeFixture(root, 'dist/background.js', 'console.log("background");');
  await writeFixture(root, 'dist/_locales/en/messages.json', '{}');

  const artifactPath = await buildReleasePackage({ rootDir: root });
  const archive = await readFile(artifactPath);
  const archiveText = archive.toString('latin1');

  assert.equal(basename(artifactPath), 'local-snack-tape-1.2.3.zip');
  assert.equal(archive[0], 0x50);
  assert.equal(archive[1], 0x4b);
  assert.equal(archive[2], 0x03);
  assert.equal(archive[3], 0x04);
  assert.match(archiveText, /manifest\.json/);
  assert.match(archiveText, /main\.js/);
  assert.match(archiveText, /background\.js/);
  assert.match(archiveText, /_locales\/en\/messages\.json/);
  assert.doesNotMatch(archiveText, /dist\/manifest\.json/);
});
