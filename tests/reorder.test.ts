// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { applySegmentOrder, moveItem, moveSegmentDown, moveSegmentUp, removeSegmentFromSequence } from '../src/shared/reorder.js';
import { makeSequence } from './helpers.js';

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

test('removeSegmentFromSequence returns sequence unchanged when segment id does not exist', () => {
  const sequence = makeSequence({ updatedAt: 100 });
  const edited = removeSegmentFromSequence(sequence, 'nonexistent', () => 200);

  assert.deepEqual(edited.segments.map((segment) => segment.id), ['a', 'b', 'c']);
  assert.equal(edited.updatedAt, 200);
});

test('moveItem returns a copy when from and to are the same index', () => {
  const original = ['a', 'b', 'c'];
  const result = moveItem(original, 1, 1);
  assert.deepEqual(result, ['a', 'b', 'c']);
  assert.notEqual(result, original);
});

test('applySegmentOrder drops unknown segment ids silently', () => {
  const sequence = makeSequence({ updatedAt: 100 });
  const edited = applySegmentOrder(sequence, ['c', 'nonexistent', 'a'], () => 200);
  assert.deepEqual(edited.segments.map((s) => s.id), ['c', 'a']);
});

test('applySegmentOrder deduplicates segment ids in the provided order', () => {
  const sequence = makeSequence({ updatedAt: 100 });
  const edited = applySegmentOrder(sequence, ['b', 'a', 'b', 'c'], () => 200);
  assert.deepEqual(edited.segments.map((s) => s.id), ['b', 'a', 'c']);
});

test('moveSegmentUp at the first position keeps segment order unchanged', () => {
  const sequence = makeSequence();
  const moved = moveSegmentUp(sequence, 'a');
  assert.deepEqual(moved.segments.map((s) => s.id), ['a', 'b', 'c']);
});

test('moveSegmentDown at the last position keeps segment order unchanged', () => {
  const sequence = makeSequence();
  const moved = moveSegmentDown(sequence, 'c');
  assert.deepEqual(moved.segments.map((s) => s.id), ['a', 'b', 'c']);
});
