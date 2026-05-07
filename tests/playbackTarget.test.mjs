import test from 'node:test';
import assert from 'node:assert/strict';
import { findYouTubePlaybackTab, isExtensionPageUrl } from '../.tmp-tests/src/shared/playbackTarget.js';

test('isExtensionPageUrl detects extension pages that should not be navigated away', () => {
  assert.equal(isExtensionPageUrl('chrome-extension://abc/sidepanel.html'), true);
  assert.equal(isExtensionPageUrl('https://www.youtube.com/watch?v=abc123XYZ_1'), false);
});

test('findYouTubePlaybackTab skips extension pages and picks a YouTube video tab', () => {
  const tabId = findYouTubePlaybackTab([
    { id: 1, url: 'chrome-extension://abc/sidepanel.html' },
    { id: 2, url: 'https://example.com/' },
    { id: 3, url: 'https://www.youtube.com/watch?v=abc123XYZ_1' }
  ]);

  assert.equal(tabId, 3);
});
