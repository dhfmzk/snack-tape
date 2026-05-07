import test from 'node:test';
import assert from 'node:assert/strict';
import { applySegmentOrder, moveItem, moveSegmentDown, moveSegmentUp, removeSegmentFromSequence } from '../.tmp-tests/src/shared/reorder.js';
import { makeSequence } from './helpers.mjs';

test('moveItem moves an item to an earlier index without mutating the input', () => {
  const original = ['a', 'b', 'c'];
  const moved = moveItem(original, 2, 1);

  assert.deepEqual(moved, ['a', 'c', 'b']);
  assert.deepEqual(original, ['a', 'b', 'c']);
});

test('moveItem moves an item to a later index without mutating the input', () => {
  const original = ['a', 'b', 'c'];
  const moved = moveItem(original, 0, 2);

  assert.deepEqual(moved, ['b', 'c', 'a']);
  assert.deepEqual(original, ['a', 'b', 'c']);
});

test('moveItem returns original logical order for invalid indexes', () => {
  const original = ['a', 'b', 'c'];
  assert.deepEqual(moveItem(original, -1, 1), original);
  assert.deepEqual(moveItem(original, 0, 3), original);
});

test('moveSegmentUp moves a segment and updates the sequence timestamp', () => {
  const sequence = makeSequence({ updatedAt: 100 });
  const moved = moveSegmentUp(sequence, 'b');

  assert.deepEqual(moved.segments.map((segment) => segment.id), ['b', 'a', 'c']);
  assert.notEqual(moved, sequence);
  assert.notEqual(moved.segments, sequence.segments);
  assert.ok(moved.updatedAt >= sequence.updatedAt);
});

test('moveSegmentDown moves a segment and does not mutate the original sequence', () => {
  const sequence = makeSequence({ updatedAt: 100 });
  const moved = moveSegmentDown(sequence, 'b');

  assert.deepEqual(moved.segments.map((segment) => segment.id), ['a', 'c', 'b']);
  assert.deepEqual(sequence.segments.map((segment) => segment.id), ['a', 'b', 'c']);
});

test('applySegmentOrder saves the edited queue as the sequence order', () => {
  const sequence = makeSequence({ updatedAt: 100 });
  const edited = applySegmentOrder(sequence, ['c', 'a'], () => 200);

  assert.deepEqual(edited.segments.map((segment) => segment.id), ['c', 'a']);
  assert.deepEqual(sequence.segments.map((segment) => segment.id), ['a', 'b', 'c']);
  assert.equal(edited.updatedAt, 200);
});

test('applySegmentOrder appends segments added after queue editing started', () => {
  const sequence = makeSequence({ updatedAt: 100 });
  const edited = applySegmentOrder(sequence, ['b', 'a'], () => 200, ['a', 'b']);

  assert.deepEqual(edited.segments.map((segment) => segment.id), ['b', 'a', 'c']);
  assert.equal(edited.updatedAt, 200);
});

test('removeSegmentFromSequence deletes one segment without mutating the original', () => {
  const sequence = makeSequence({ updatedAt: 100 });
  const edited = removeSegmentFromSequence(sequence, 'b', () => 200);

  assert.deepEqual(edited.segments.map((segment) => segment.id), ['a', 'c']);
  assert.deepEqual(sequence.segments.map((segment) => segment.id), ['a', 'b', 'c']);
  assert.equal(edited.updatedAt, 200);
});
