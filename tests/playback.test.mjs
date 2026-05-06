import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlaybackOrder,
  describePlaybackState,
  getNextPlaybackStep,
  getNextSegmentIndex,
  isFinalSegment,
  playbackStateAfterSequenceEdit
} from '../.tmp-tests/src/shared/playback.js';
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

test('createPlaybackOrder returns a sequential order from the selected start index', () => {
  assert.deepEqual(createPlaybackOrder(4, 2, 'sequence'), [2, 3]);
});

test('createPlaybackOrder keeps the selected segment first in shuffle mode', () => {
  const order = createPlaybackOrder(4, 1, 'shuffle', () => 0);

  assert.deepEqual(order, [1, 0, 2, 3]);
  assert.equal(new Set(order).size, 4);
});

test('getNextPlaybackStep follows the stored playback order when present', () => {
  const sequence = makeSequence();
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 1,
    status: 'playing',
    startedAt: 1700000000000,
    order: [1, 0, 2],
    orderPosition: 0,
    mode: 'shuffle'
  };

  assert.deepEqual(getNextPlaybackStep(sequence, state), {
    segmentIndex: 0,
    orderPosition: 1
  });
});

test('getNextPlaybackStep resolves segment id order after sequence reorder', () => {
  const sequence = makeSequence({
    segments: [
      makeSequence().segments[2],
      makeSequence().segments[0],
      makeSequence().segments[1]
    ]
  });
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 1,
    currentSegmentId: 'b',
    status: 'playing',
    startedAt: 1700000000000,
    orderSegmentIds: ['b', 'a', 'c'],
    orderPosition: 0,
    mode: 'shuffle'
  };

  assert.deepEqual(getNextPlaybackStep(sequence, state), {
    segmentIndex: 1,
    orderPosition: 1
  });
});

test('getNextPlaybackStep skips deleted segment ids in stored order', () => {
  const sequence = makeSequence({
    segments: [
      makeSequence().segments[1],
      makeSequence().segments[2]
    ]
  });
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    currentSegmentId: 'b',
    status: 'playing',
    startedAt: 1700000000000,
    orderSegmentIds: ['b', 'a', 'c'],
    orderPosition: 0,
    mode: 'shuffle'
  };

  assert.deepEqual(getNextPlaybackStep(sequence, state), {
    segmentIndex: 1,
    orderPosition: 2
  });
});

test('describePlaybackState returns Korean display data for playback status', () => {
  const sequence = makeSequence();
  const store = {
    sequences: [sequence],
    selectedSequenceId: sequence.id
  };
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 1,
    status: 'playing',
    startedAt: 1700000000000,
    order: [2, 1, 0],
    orderPosition: 1,
    mode: 'shuffle'
  };

  assert.deepEqual(describePlaybackState(store, state), {
    sequenceName: '테스트 시퀀스',
    segmentTitle: '테스트 영상',
    positionText: '2 / 3',
    modeLabel: '랜덤 재생',
    canStop: true
  });
});

test('describePlaybackState resolves current segment id after sequence reorder', () => {
  const sequence = makeSequence({
    segments: [
      makeSequence().segments[2],
      makeSequence().segments[0],
      makeSequence().segments[1]
    ]
  });
  const store = {
    sequences: [sequence],
    selectedSequenceId: sequence.id
  };
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 1,
    currentSegmentId: 'b',
    status: 'playing',
    startedAt: 1700000000000,
    orderSegmentIds: ['b', 'a', 'c'],
    orderPosition: 0,
    mode: 'shuffle'
  };

  assert.equal(describePlaybackState(store, state)?.segmentTitle, '테스트 영상');
  assert.equal(describePlaybackState(store, state)?.positionText, '1 / 3');
});

test('playbackStateAfterSequenceEdit keeps the current clip and follows the edited queue next', () => {
  const sequence = makeSequence({
    segments: [
      makeSequence().segments[2],
      makeSequence().segments[1],
      makeSequence().segments[0]
    ]
  });
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 1,
    currentSegmentId: 'b',
    status: 'playing',
    startedAt: 1700000000000,
    orderSegmentIds: ['b', 'a', 'c'],
    orderPosition: 0,
    mode: 'shuffle'
  };
  const synced = playbackStateAfterSequenceEdit(state, sequence);

  assert.equal(synced.currentSegmentId, 'b');
  assert.equal(synced.segmentIndex, 1);
  assert.equal(synced.mode, 'sequence');
  assert.deepEqual(synced.orderSegmentIds, ['c', 'b', 'a']);
  assert.equal(synced.orderPosition, 1);
  assert.deepEqual(getNextPlaybackStep(sequence, synced), {
    segmentIndex: 2,
    orderPosition: 2
  });
});
