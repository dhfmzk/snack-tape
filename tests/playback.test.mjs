import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextSegmentIndex, isFinalSegment } from '../.tmp-tests/src/shared/playback.js';
import { makeSequence } from './helpers.mjs';

test('getNextSegmentIndex returns the next index when one exists', () => {
  assert.equal(getNextSegmentIndex(makeSequence(), 0), 1);
});

test('getNextSegmentIndex returns null for the final segment', () => {
  assert.equal(getNextSegmentIndex(makeSequence(), 2), null);
});

test('playback helpers handle empty sequences safely', () => {
  const sequence = makeSequence({ segments: [] });

  assert.equal(getNextSegmentIndex(sequence, 0), null);
  assert.equal(isFinalSegment(sequence, 0), false);
});
