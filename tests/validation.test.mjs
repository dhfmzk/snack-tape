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

test('validateSegment rejects whitespace-only video ID', () => {
  assert.match(validateSegment(makeSegment({ videoId: '   ' })).join('\n'), /영상 ID/);
});

test('validateSegment rejects empty title', () => {
  assert.match(validateSegment(makeSegment({ title: '' })).join('\n'), /영상 제목/);
});

test('validateSegment rejects whitespace-only title', () => {
  assert.match(validateSegment(makeSegment({ title: '   ' })).join('\n'), /영상 제목/);
});

test('validateSegment rejects negative start time', () => {
  assert.match(validateSegment(makeSegment({ startSeconds: -1 })).join('\n'), /시작/);
});

test('validateSegment rejects NaN start time', () => {
  assert.match(validateSegment(makeSegment({ startSeconds: NaN })).join('\n'), /시작/);
});

test('validateSegment rejects Infinity start time', () => {
  assert.match(validateSegment(makeSegment({ startSeconds: Infinity })).join('\n'), /시작/);
});

test('validateSegment accepts null end time', () => {
  assert.deepEqual(validateSegment(makeSegment({ endSeconds: null })), []);
});

test('validateSegment rejects end time before start time', () => {
  assert.match(validateSegment(makeSegment({ startSeconds: 20, endSeconds: 10 })).join('\n'), /끝점/);
});

test('validateSegment rejects a zero-length saved range', () => {
  assert.match(validateSegment(makeSegment({ startSeconds: 0, endSeconds: 0 })).join('\n'), /끝점/);
  assert.match(validateSegment(makeSegment({ startSeconds: 12, endSeconds: 12 })).join('\n'), /끝점/);
});

test('validateSegment rejects negative end time', () => {
  assert.match(validateSegment(makeSegment({ startSeconds: 0, endSeconds: -1 })).join('\n'), /끝점/);
});

test('validateSegment can report multiple errors at once', () => {
  const errors = validateSegment(makeSegment({ videoId: '', title: '', startSeconds: -1 }));
  assert.ok(errors.length >= 3, `expected at least 3 errors, got ${errors.length}`);
});

test('validateSequence rejects empty sequences before playback', () => {
  assert.match(validateSequence(makeSequence({ segments: [] })).join('\n'), /재생할 구간/);
});

test('validateSequence rejects empty sequence name', () => {
  assert.match(validateSequence(makeSequence({ name: '' })).join('\n'), /시퀀스 이름/);
});

test('validateSequence rejects whitespace-only sequence name', () => {
  assert.match(validateSequence(makeSequence({ name: '   ' })).join('\n'), /시퀀스 이름/);
});

test('validateSequence prefixes per-segment errors with position number', () => {
  const sequence = makeSequence({
    segments: [makeSegment({ videoId: '' })]
  });
  const errors = validateSequence(sequence);
  assert.match(errors.join('\n'), /1번째 구간/);
});

test('validateSequence accepts a valid sequence with segments', () => {
  assert.deepEqual(validateSequence(makeSequence()), []);
});
