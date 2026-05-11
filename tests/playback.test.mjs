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

test('playbackStateAfterSequenceEdit keeps the current clip, playback mode, and edited queue next', () => {
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
  assert.equal(synced.mode, 'shuffle');
  assert.deepEqual(synced.orderSegmentIds, ['c', 'b', 'a']);
  assert.equal(synced.orderPosition, 1);
  assert.deepEqual(getNextPlaybackStep(sequence, synced), {
    segmentIndex: 2,
    orderPosition: 2
  });
});

test('createPlaybackOrder returns empty array for invalid inputs', () => {
  assert.deepEqual(createPlaybackOrder(0, 0, 'sequence'), []);
  assert.deepEqual(createPlaybackOrder(-1, 0, 'sequence'), []);
  assert.deepEqual(createPlaybackOrder(1.5, 0, 'sequence'), []);
  assert.deepEqual(createPlaybackOrder(3, -1, 'sequence'), []);
  assert.deepEqual(createPlaybackOrder(3, 3, 'sequence'), []);
});

test('createPlaybackOrder returns single-item order for repeat mode', () => {
  assert.deepEqual(createPlaybackOrder(3, 0, 'repeat'), [0]);
  assert.deepEqual(createPlaybackOrder(3, 2, 'repeat'), [2]);
});

test('createPlaybackOrder defaults to sequence mode starting at index 0', () => {
  assert.deepEqual(createPlaybackOrder(3), [0, 1, 2]);
});

test('getNextPlaybackStep returns null when sequence is empty', () => {
  const sequence = makeSequence({ segments: [] });
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    status: 'playing',
    startedAt: 1700000000000
  };
  assert.equal(getNextPlaybackStep(sequence, state), null);
});

test('getNextPlaybackStep repeats current segment in repeat mode', () => {
  const sequence = makeSequence();
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 1,
    currentSegmentId: 'b',
    status: 'playing',
    startedAt: 1700000000000,
    mode: 'repeat'
  };
  assert.deepEqual(getNextPlaybackStep(sequence, state), {
    segmentIndex: 1,
    orderPosition: 0
  });
});

test('getNextPlaybackStep uses sequential fallback when no order is stored', () => {
  const sequence = makeSequence();
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    status: 'playing',
    startedAt: 1700000000000
  };
  assert.deepEqual(getNextPlaybackStep(sequence, state), {
    segmentIndex: 1,
    orderPosition: 1
  });
});

test('getNextPlaybackStep returns null at the end of a sequential order', () => {
  const sequence = makeSequence();
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 2,
    status: 'playing',
    startedAt: 1700000000000
  };
  assert.equal(getNextPlaybackStep(sequence, state), null);
});

test('describePlaybackState returns null for null state', () => {
  const sequence = makeSequence();
  const store = { sequences: [sequence], selectedSequenceId: sequence.id };
  assert.equal(describePlaybackState(store, null), null);
});

test('describePlaybackState returns null for stopped or idle status', () => {
  const sequence = makeSequence();
  const store = { sequences: [sequence], selectedSequenceId: sequence.id };
  for (const status of ['stopped', 'idle']) {
    const state = {
      sequenceId: sequence.id,
      segmentIndex: 0,
      status,
      startedAt: 1700000000000
    };
    assert.equal(describePlaybackState(store, state), null, `expected null for status=${status}`);
  }
});

test('describePlaybackState returns display data for waiting, pending, and paused status', () => {
  const sequence = makeSequence();
  const store = { sequences: [sequence], selectedSequenceId: sequence.id };
  for (const status of ['waiting', 'pending', 'paused']) {
    const state = {
      sequenceId: sequence.id,
      segmentIndex: 0,
      status,
      startedAt: 1700000000000,
      mode: 'sequence'
    };
    const display = describePlaybackState(store, state);
    assert.ok(display !== null, `expected display for status=${status}`);
  }
});

test('describePlaybackState returns null when sequence is not found in store', () => {
  const sequence = makeSequence();
  const store = { sequences: [], selectedSequenceId: null };
  const state = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    status: 'playing',
    startedAt: 1700000000000
  };
  assert.equal(describePlaybackState(store, state), null);
});

test('describePlaybackState uses correct Korean mode labels', () => {
  const sequence = makeSequence();
  const store = { sequences: [sequence], selectedSequenceId: sequence.id };
  const baseState = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    currentSegmentId: 'a',
    status: 'playing',
    startedAt: 1700000000000,
    orderSegmentIds: ['a', 'b', 'c'],
    orderPosition: 0
  };

  const sequenceDisplay = describePlaybackState(store, { ...baseState, mode: 'sequence' });
  const repeatDisplay = describePlaybackState(store, { ...baseState, mode: 'repeat' });

  assert.equal(sequenceDisplay?.modeLabel, '순서대로 재생');
  assert.equal(repeatDisplay?.modeLabel, '반복 재생');
});

test('isFinalSegment identifies the last segment correctly', () => {
  const sequence = makeSequence();
  assert.equal(isFinalSegment(sequence, 2), true);
  assert.equal(isFinalSegment(sequence, 1), false);
  assert.equal(isFinalSegment(sequence, 0), false);
});

test('isFinalSegment returns false for invalid index', () => {
  const sequence = makeSequence();
  assert.equal(isFinalSegment(sequence, -1), false);
  assert.equal(isFinalSegment(sequence, 10), false);
});
