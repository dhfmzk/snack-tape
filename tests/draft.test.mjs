import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSegmentDraft } from '../.tmp-tests/src/shared/draft.js';

test('normalizeSegmentDraft keeps valid draft times for one video', () => {
  assert.deepEqual(
    normalizeSegmentDraft({
      videoId: 'abc123XYZ_1',
      startSeconds: 12.9,
      endSeconds: 30.2,
      updatedAt: 1700000000000
    }),
    {
      videoId: 'abc123XYZ_1',
      startSeconds: 12.9,
      endSeconds: 30.2,
      updatedAt: 1700000000000
    }
  );
});

test('normalizeSegmentDraft accepts a start-only draft', () => {
  assert.deepEqual(
    normalizeSegmentDraft({
      videoId: 'abc123XYZ_1',
      startSeconds: 12,
      endSeconds: null,
      updatedAt: 1700000000000
    }),
    {
      videoId: 'abc123XYZ_1',
      startSeconds: 12,
      endSeconds: null,
      updatedAt: 1700000000000
    }
  );
});

test('normalizeSegmentDraft accepts an end-only draft', () => {
  assert.deepEqual(
    normalizeSegmentDraft({
      videoId: 'abc123XYZ_1',
      startSeconds: null,
      endSeconds: 30,
      updatedAt: 1700000000000
    }),
    {
      videoId: 'abc123XYZ_1',
      startSeconds: null,
      endSeconds: 30,
      updatedAt: 1700000000000
    }
  );
});

test('normalizeSegmentDraft trims whitespace from videoId', () => {
  const result = normalizeSegmentDraft({
    videoId: '  abc123XYZ_1  ',
    startSeconds: 5,
    endSeconds: null,
    updatedAt: 1700000000000
  });
  assert.equal(result?.videoId, 'abc123XYZ_1');
});

test('normalizeSegmentDraft falls back to Date.now when updatedAt is missing', () => {
  const before = Date.now();
  const result = normalizeSegmentDraft({
    videoId: 'abc123XYZ_1',
    startSeconds: 5,
    endSeconds: null
  });
  const after = Date.now();
  assert.ok(result !== null);
  assert.ok(result.updatedAt >= before && result.updatedAt <= after);
});

test('normalizeSegmentDraft rejects malformed drafts', () => {
  assert.equal(normalizeSegmentDraft(null), null);
  assert.equal(normalizeSegmentDraft({ videoId: '', startSeconds: 1, endSeconds: 2 }), null);
  assert.equal(normalizeSegmentDraft({ videoId: 'abc123XYZ_1', startSeconds: -1, endSeconds: 2 }), null);
  assert.equal(normalizeSegmentDraft({ videoId: 'abc123XYZ_1', startSeconds: 5, endSeconds: 4 }), null);
});

test('normalizeSegmentDraft rejects a draft where both times are null', () => {
  assert.equal(
    normalizeSegmentDraft({ videoId: 'abc123XYZ_1', startSeconds: null, endSeconds: null }),
    null
  );
});

test('normalizeSegmentDraft rejects non-finite time values', () => {
  assert.equal(
    normalizeSegmentDraft({ videoId: 'abc123XYZ_1', startSeconds: Infinity, endSeconds: null }),
    null
  );
  assert.equal(
    normalizeSegmentDraft({ videoId: 'abc123XYZ_1', startSeconds: NaN, endSeconds: null }),
    null
  );
});
