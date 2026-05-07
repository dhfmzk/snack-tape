import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYouTubeVideoId } from '../.tmp-tests/src/shared/youtube.js';

test('parseYouTubeVideoId extracts IDs from supported YouTube watch URLs only', () => {
  const validUrls = [
    'https://www.youtube.com/watch?v=abc123XYZ_1',
    'https://youtube.com/watch?v=abc123XYZ_1&t=30s',
    'https://m.youtube.com/watch?v=abc123XYZ_1'
  ];

  for (const url of validUrls) {
    assert.equal(parseYouTubeVideoId(url), 'abc123XYZ_1');
  }
});

test('parseYouTubeVideoId rejects invalid URLs', () => {
  const invalidUrls = [
    'https://example.com/watch?v=abc',
    'not a url',
    'https://www.youtube.com/watch',
    'https://youtu.be/',
    'https://youtu.be/abc123XYZ_1',
    'https://www.youtube.com/shorts/abc123XYZ_1',
    'https://www.youtube.com/embed/abc123XYZ_1'
  ];

  for (const url of invalidUrls) {
    assert.equal(parseYouTubeVideoId(url), null);
  }
});
