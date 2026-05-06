import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings } from '../.tmp-tests/src/state/storage.js';

test('settings default to the handoff M1 peach theme', () => {
  assert.equal(DEFAULT_SETTINGS.accentKey, 'peach');
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
