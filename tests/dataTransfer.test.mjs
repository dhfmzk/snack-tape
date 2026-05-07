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
