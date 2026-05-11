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

test('parseYouTubeVideoId rejects video IDs shorter than 6 characters', () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=abc'), null);
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=ab123'), null);
});

test('parseYouTubeVideoId accepts minimum-length 6-character video IDs', () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=abc123'), 'abc123');
});

test('parseYouTubeVideoId rejects IDs with invalid characters', () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=abc!@#xyz'), null);
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=abc 123'), null);
});

test('parseYouTubeVideoId accepts underscore and hyphen in video IDs', () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=abc_12-xyz'), 'abc_12-xyz');
});

test('parseYouTubeVideoId returns null when v param is missing', () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?list=PLtest'), null);
});

