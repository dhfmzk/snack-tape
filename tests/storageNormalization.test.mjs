import test from 'node:test';
import assert from 'node:assert/strict';

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
