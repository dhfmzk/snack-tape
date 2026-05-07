import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings } from '../.tmp-tests/src/state/storage.js';

test('settings default to the handoff M1 peach theme', () => {
  assert.equal(DEFAULT_SETTINGS.accentKey, 'peach');
});

test('settings expose the manifest shortcut defaults as read-only labels', () => {
  assert.equal(DEFAULT_SETTINGS.shortcutIn, 'Alt+I');
  assert.equal(DEFAULT_SETTINGS.shortcutOut, 'Alt+O');
});

test('settings default to Korean UI and repair unsupported languages', () => {
  assert.equal(DEFAULT_SETTINGS.language, 'ko');
  assert.equal(normalizeSettings({ language: 'en' }).language, 'en');
  assert.equal(normalizeSettings({ language: 'fr' }).language, 'ko');
  assert.equal(normalizeSettings(null).language, 'ko');
});

test('normalizeSettings keeps supported accent keys and repairs invalid input', () => {
  assert.equal(normalizeSettings({ accentKey: 'sky' }).accentKey, 'sky');
  assert.equal(normalizeSettings({ accentKey: 'purple' }).accentKey, 'peach');
  assert.equal(normalizeSettings(null).accentKey, 'peach');
});

test('normalizeSettings repairs shortcut drift to the actual Chrome commands', () => {
  const settings = normalizeSettings({
    shortcutIn: 'Ctrl+Shift+P',
    shortcutOut: 'X'
  });

  assert.equal(settings.shortcutIn, 'Alt+I');
  assert.equal(settings.shortcutOut, 'Alt+O');
});
