import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.mjs';

test('storage fallback names are language-neutral generated values', async () => {
  const { createDefaultSequence, normalizeSegment, normalizeSequence, normalizeStore } = await import('../.tmp-tests/src/shared/storage.js');

  const defaultSequence = createDefaultSequence();
  const normalizedSequence = normalizeSequence({ id: 'sequence-imported', segments: [] }, 1);
  const normalizedSegment = normalizeSegment({
    videoId: 'abc123XYZ_1',
    originalUrl: 'https://www.youtube.com/watch?v=abc123XYZ_1',
    startSeconds: 10,
    endSeconds: 20
  });
  const normalizedStore = normalizeStore(null);

  assert.equal(defaultSequence.name, 'Mixtape 1');
  assert.equal(normalizedSequence.name, 'Mixtape 2');
  assert.equal(normalizedSegment.title, 'YouTube abc123XYZ_1');
  assert.equal(normalizedStore.sequences[0].name, 'Mixtape 1');
});

test('normalizeStore returns a default single-sequence store for non-object input', async () => {
  const { normalizeStore } = await import('../.tmp-tests/src/shared/storage.js');

  for (const invalid of [null, undefined, 42, 'string', []]) {
    const store = normalizeStore(invalid);
    assert.equal(store.sequences.length, 1);
    assert.equal(store.sequences[0].name, 'Mixtape 1');
    assert.equal(store.selectedSequenceId, store.sequences[0].id);
  }
});

test('normalizeStore returns a default store when sequences field is missing or not an array', async () => {
  const { normalizeStore } = await import('../.tmp-tests/src/shared/storage.js');

  const store = normalizeStore({ selectedSequenceId: 'seq-1' });
  assert.equal(store.sequences.length, 1);
  assert.equal(store.selectedSequenceId, store.sequences[0].id);
});

test('normalizeStore falls back to the first sequence when selectedSequenceId is invalid', async () => {
  const { normalizeStore } = await import('../.tmp-tests/src/shared/storage.js');

  const sequence = makeSequence({ id: 'seq-valid' });
  const store = normalizeStore({
    sequences: [sequence],
    selectedSequenceId: 'nonexistent-id'
  });
  assert.equal(store.selectedSequenceId, 'seq-valid');
});

test('normalizeStore preserves valid selectedSequenceId', async () => {
  const { normalizeStore } = await import('../.tmp-tests/src/shared/storage.js');

  const seq1 = makeSequence({ id: 'seq-1' });
  const seq2 = makeSequence({ id: 'seq-2' });
  const store = normalizeStore({
    sequences: [seq1, seq2],
    selectedSequenceId: 'seq-2'
  });
  assert.equal(store.selectedSequenceId, 'seq-2');
});

test('normalizeSequence filters out invalid segments', async () => {
  const { normalizeSequence } = await import('../.tmp-tests/src/shared/storage.js');

  const validSegment = makeSegment({ id: 'valid-seg', videoId: 'abc123XYZ_1' });
  const invalidSegment = { id: 'invalid-seg', videoId: '', startSeconds: 10 };
  const sequence = normalizeSequence({
    id: 'seq-filter',
    name: 'Test',
    segments: [validSegment, invalidSegment]
  });

  assert.equal(sequence.segments.length, 1);
  assert.equal(sequence.segments[0].id, 'valid-seg');
});

test('normalizeImportedStore returns null for non-object inputs', async () => {
  const { normalizeImportedStore } = await import('../.tmp-tests/src/shared/storage.js');

  assert.equal(normalizeImportedStore(null), null);
  assert.equal(normalizeImportedStore(undefined), null);
  assert.equal(normalizeImportedStore('not an object'), null);
  assert.equal(normalizeImportedStore(42), null);
  assert.equal(normalizeImportedStore([]), null);
});

test('normalizeImportedStore accepts a legacy single-sequence object with segments array', async () => {
  const { normalizeImportedStore } = await import('../.tmp-tests/src/shared/storage.js');

  const segment = makeSegment({ id: 'legacy-seg' });
  const result = normalizeImportedStore({
    id: 'legacy-seq',
    name: 'Legacy Tape',
    segments: [segment]
  });

  assert.ok(result !== null);
  assert.equal(result.sequences.length, 1);
  assert.equal(result.sequences[0].segments[0].id, 'legacy-seg');
});
