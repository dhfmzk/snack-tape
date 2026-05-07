import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.mjs';

test('serializeStoreJson wraps the mixtape store for backup import', async () => {
  const { serializeStoreJson, parseImportedStoreJson } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const sequence = makeSequence({ id: 'sequence-json', name: 'JSON Tape', segments: [makeSegment({ id: 'clip-json' })] });
  const store = {
    sequences: [sequence],
    selectedSequenceId: sequence.id
  };

  const text = serializeStoreJson(store);
  const parsed = parseImportedStoreJson(text);

  assert.match(text, /"app": "SnackTape"/);
  assert.equal(parsed.sequences[0].id, sequence.id);
  assert.equal(parsed.selectedSequenceId, sequence.id);
});

test('serializeStoreCsv exports one row per saved segment', async () => {
  const { serializeStoreCsv } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const sequence = makeSequence({
    id: 'sequence-csv',
    name: 'Comma, Tape',
    segments: [
      makeSegment({ id: 'clip-1', title: 'Plain title', startSeconds: 1, endSeconds: 2 }),
      makeSegment({ id: 'clip-2', title: 'Quoted "title"', startSeconds: 3, endSeconds: null })
    ]
  });

  const csv = serializeStoreCsv({
    sequences: [sequence],
    selectedSequenceId: sequence.id
  });

  assert.match(csv, /^mixtape,title,videoId/m);
  assert.match(csv, /"Comma, Tape",Plain title/);
  assert.match(csv, /"Quoted ""title"""/);
});

test('parseImportedStoreJson drops normalized segments whose end is not after start', async () => {
  const { parseImportedStoreJson } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const valid = makeSegment({ id: 'clip-valid', startSeconds: 20, endSeconds: 22 });
  const invalidEqual = makeSegment({ id: 'clip-equal', startSeconds: 12, endSeconds: 12 });
  const invalidZero = makeSegment({ id: 'clip-zero', startSeconds: 0, endSeconds: 0 });
  const parsed = parseImportedStoreJson(JSON.stringify({
    sequences: [
      makeSequence({
        id: 'sequence-import-repair',
        segments: [invalidEqual, invalidZero, valid]
      })
    ],
    selectedSequenceId: 'sequence-import-repair'
  }));

  assert.equal(parsed.sequences[0].segments.length, 1);
  assert.equal(parsed.sequences[0].segments[0].id, 'clip-valid');
});
