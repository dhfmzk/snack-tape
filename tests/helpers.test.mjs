import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAppState, makeSequence } from './helpers.mjs';

test('makeAppState merges provided store with explicit sequence defaults', () => {
  const first = makeSequence({ id: 'first' });
  const second = makeSequence({ id: 'second' });

  const state = makeAppState({
    store: { sequences: [first], selectedSequenceId: first.id },
    sequences: [first, second],
    selectedSequenceId: second.id
  });

  assert.deepEqual(state.store.sequences.map((sequence) => sequence.id), ['first', 'second']);
  assert.equal(state.store.selectedSequenceId, 'second');
});

test('makeAppState mirrors nullable production playback notice state', () => {
  assert.equal(makeAppState().playbackNotice, null);
  assert.deepEqual(makeAppState({ playbackNotice: { kind: 'info', message: 'Ready' } }).playbackNotice, {
    kind: 'info',
    message: 'Ready'
  });
});
