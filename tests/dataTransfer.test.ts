// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.js';

test('serializeStoreJson wraps the mixtape store for backup import', async () => {
  const { serializeStoreJson, parseImportedStoreJson } = await import('../src/shared/dataTransfer.js');
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
  const { serializeStoreCsv } = await import('../src/shared/dataTransfer.js');
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

test('serializeStoreCsv includes the note column in the header', async () => {
  const { serializeStoreCsv } = await import('../src/shared/dataTransfer.js');
  const csv = serializeStoreCsv({
    sequences: [makeSequence({ id: 'seq-note', segments: [makeSegment({ id: 'clip-note', note: 'My note' })] })],
    selectedSequenceId: 'seq-note'
  });
  assert.match(csv, /note/);
  assert.match(csv, /My note/);
});

test('serializeStoreCsv exports an empty body for a store with no segments', async () => {
  const { serializeStoreCsv } = await import('../src/shared/dataTransfer.js');
  const csv = serializeStoreCsv({ sequences: [], selectedSequenceId: null });
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^mixtape,title,videoId/);
});

test('parseImportedStoreJson drops normalized segments whose end is not after start', async () => {
  const { parseImportedStoreJson } = await import('../src/shared/dataTransfer.js');
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

test('parseImportedStoreJson returns null for invalid JSON text', async () => {
  const { parseImportedStoreJson } = await import('../src/shared/dataTransfer.js');
  assert.equal(parseImportedStoreJson('not valid json'), null);
  assert.equal(parseImportedStoreJson(''), null);
});

test('parseImportedStoreJson returns null for a JSON value with no sequences or segments', async () => {
  const { parseImportedStoreJson } = await import('../src/shared/dataTransfer.js');
  assert.equal(parseImportedStoreJson(JSON.stringify({ random: 'data' })), null);
  assert.equal(parseImportedStoreJson(JSON.stringify(null)), null);
  assert.equal(parseImportedStoreJson(JSON.stringify(42)), null);
});

test('parseImportedStoreJson parses a plain store object without an export wrapper', async () => {
  const { parseImportedStoreJson } = await import('../src/shared/dataTransfer.js');
  const sequence = makeSequence({ id: 'seq-plain' });
  const parsed = parseImportedStoreJson(JSON.stringify({
    sequences: [sequence],
    selectedSequenceId: sequence.id
  }));
  assert.ok(parsed !== null);
  assert.equal(parsed.sequences[0].id, 'seq-plain');
});

test('createExportPayload includes app name, version, exportedAt and store', async () => {
  const { createExportPayload } = await import('../src/shared/dataTransfer.js');
  const store = { sequences: [], selectedSequenceId: null };
  const payload = createExportPayload(store, '2024-01-01T00:00:00.000Z');

  assert.equal(payload.app, 'SnackTape');
  assert.equal(payload.version, 1);
  assert.equal(payload.exportedAt, '2024-01-01T00:00:00.000Z');
  assert.equal(payload.store, store);
});

