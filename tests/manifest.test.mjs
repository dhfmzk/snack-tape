import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('manifest uses Chrome-loadable command defaults', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

  assert.equal(manifest.commands['next-clip'].suggested_key.default, 'Alt+N');
  assert.doesNotMatch(JSON.stringify(manifest.commands), /Alt\+\]/);
});

test('README documents the side panel flow instead of legacy popup/editor entrypoints', async () => {
  const [manifestText, readme] = await Promise.all([
    readFile(new URL('../manifest.json', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
  assert.equal(manifest.action.default_popup, undefined);
  assert.equal(manifest.options_ui, undefined);
  assert.match(readme, /사이드 패널/);
  assert.match(readme, /편집 \/ 믹스테이프 \/ 설정/);
  assert.doesNotMatch(readme, /확장 프로그램 팝업|팝업의|편집 열기|편집 페이지/);
});
