import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

async function pathExists(url) {
  try {
    await stat(url);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

test('manifest uses Chrome-loadable command defaults', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

  assert.equal(manifest.commands['next-clip'].suggested_key.default, 'Alt+N');
  assert.doesNotMatch(JSON.stringify(manifest.commands), /Alt\+\]/);
});

test('README stays concise and documents developer-mode loading', async () => {
  const [manifestText, readme] = await Promise.all([
    readFile(new URL('../manifest.json', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
  assert.equal(manifest.action.default_popup, undefined);
  assert.equal(manifest.options_ui, undefined);
  assert.match(readme, /Chrome MV3 side-panel extension/);
  assert.match(readme, /Edit \/ Mixtapes \/ Settings/);
  assert.match(readme, /Developer Mode/);
  assert.match(readme, /npm run build/);
  assert.match(readme, /chrome:\/\/extensions/);
  assert.match(readme, /Load unpacked/);
  assert.match(readme, /dist\//);
  assert.doesNotMatch(readme, /Manual QA Checklist|How to Use|Install and Build/);
});

test('legacy editor source is removed from the MV3 side-panel app', async () => {
  assert.equal(await pathExists(new URL('../src/editor/editor.html', import.meta.url)), false);
  assert.equal(await pathExists(new URL('../src/editor/editor.css', import.meta.url)), false);
  assert.equal(await pathExists(new URL('../src/editor/editor.ts', import.meta.url)), false);
});

test('manifest metadata uses Chrome locale messages with English default locale', async () => {
  const [manifestText, englishLocaleText] = await Promise.all([
    readFile(new URL('../manifest.json', import.meta.url), 'utf8'),
    readFile(new URL('../public/_locales/en/messages.json', import.meta.url), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const englishLocale = JSON.parse(englishLocaleText);

  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.name, '__MSG_appName__');
  assert.equal(manifest.description, '__MSG_appDescription__');
  assert.equal(englishLocale.appName.message, 'SnackTape');
  assert.match(englishLocale.appDescription.message, /YouTube ranges/);
});

test('manifest permissions are covered by the permission audit', async () => {
  const [manifestText, audit] = await Promise.all([
    readFile(new URL('../manifest.json', import.meta.url), 'utf8'),
    readFile(new URL('../docs/permissions-audit.md', import.meta.url), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.deepEqual(manifest.permissions, ['sidePanel', 'storage', 'tabs', 'scripting']);
  assert.deepEqual(manifest.host_permissions, ['https://*.youtube.com/*']);
  for (const permission of manifest.permissions) {
    assert.match(audit, new RegExp(`\`${permission}\``));
  }
  assert.match(audit, /https:\/\/\*\.youtube\.com\/\*/);
  assert.match(audit, /activeTab/);
});
