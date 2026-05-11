import test from 'node:test';
import assert from 'node:assert/strict';
import { findYouTubePlaybackTab, isExtensionPageUrl } from '../.tmp-tests/src/shared/playbackTarget.js';

test('isExtensionPageUrl detects extension pages that should not be navigated away', () => {
  assert.equal(isExtensionPageUrl('chrome-extension://abc/sidepanel.html'), true);
  assert.equal(isExtensionPageUrl('https://www.youtube.com/watch?v=abc123XYZ_1'), false);
});

test('isExtensionPageUrl returns false for undefined', () => {
  assert.equal(isExtensionPageUrl(undefined), false);
});

test('isExtensionPageUrl returns false for non-extension URLs', () => {
  assert.equal(isExtensionPageUrl('http://example.com'), false);
  assert.equal(isExtensionPageUrl(''), false);
});

test('findYouTubePlaybackTab skips extension pages and picks a YouTube video tab', () => {
  const tabId = findYouTubePlaybackTab([
    { id: 1, url: 'chrome-extension://abc/sidepanel.html' },
    { id: 2, url: 'https://example.com/' },
    { id: 3, url: 'https://www.youtube.com/watch?v=abc123XYZ_1' }
  ]);

  assert.equal(tabId, 3);
});

test('findYouTubePlaybackTab returns null for an empty tab list', () => {
  assert.equal(findYouTubePlaybackTab([]), null);
});

test('findYouTubePlaybackTab returns null when no YouTube tabs are present', () => {
  const tabId = findYouTubePlaybackTab([
    { id: 1, url: 'https://example.com/' },
    { id: 2, url: 'https://github.com/' }
  ]);
  assert.equal(tabId, null);
});

test('findYouTubePlaybackTab skips tabs without an id', () => {
  const tabId = findYouTubePlaybackTab([
    { url: 'https://www.youtube.com/watch?v=abc123XYZ_1' },
    { id: 5, url: 'https://www.youtube.com/watch?v=abc123XYZ_1' }
  ]);
  assert.equal(tabId, 5);
});

test('findYouTubePlaybackTab returns the first matching YouTube tab', () => {
  const tabId = findYouTubePlaybackTab([
    { id: 10, url: 'https://www.youtube.com/watch?v=abc123XYZ_1' },
    { id: 20, url: 'https://www.youtube.com/watch?v=abc123XYZ_2' }
  ]);
  assert.equal(tabId, 10);
});

