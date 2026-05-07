import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSegment, validateSequence } from '../.tmp-tests/src/shared/validation.js';
import { makeSegment, makeSequence } from './helpers.mjs';

test('validateSegment accepts a valid segment', () => {
  assert.deepEqual(validateSegment(makeSegment()), []);
});

test('validateSegment rejects empty video ID', () => {
  assert.match(validateSegment(makeSegment({ videoId: '' })).join('\n'), /영상 ID/);
});

test('validateSegment rejects negative start time', () => {
  assert.match(validateSegment(makeSegment({ startSeconds: -1 })).join('\n'), /시작/);
});

test('validateSegment rejects end time before start time', () => {
  assert.match(validateSegment(makeSegment({ startSeconds: 20, endSeconds: 10 })).join('\n'), /끝점/);
});

test('validateSegment rejects a zero-length saved range', () => {
  assert.match(validateSegment(makeSegment({ startSeconds: 0, endSeconds: 0 })).join('\n'), /끝점/);
  assert.match(validateSegment(makeSegment({ startSeconds: 12, endSeconds: 12 })).join('\n'), /끝점/);
});

test('validateSequence rejects empty sequences before playback', () => {
  assert.match(validateSequence(makeSequence({ segments: [] })).join('\n'), /재생할 구간/);
});
