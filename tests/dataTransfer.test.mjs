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

test('serializeStoreCsv includes the note column in the header', async () => {
  const { serializeStoreCsv } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const csv = serializeStoreCsv({
    sequences: [makeSequence({ id: 'seq-note', segments: [makeSegment({ id: 'clip-note', note: 'My note' })] })],
    selectedSequenceId: 'seq-note'
  });
  assert.match(csv, /note/);
  assert.match(csv, /My note/);
});

test('serializeStoreCsv exports an empty body for a store with no segments', async () => {
  const { serializeStoreCsv } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const csv = serializeStoreCsv({ sequences: [], selectedSequenceId: null });
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^mixtape,title,videoId/);
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

test('parseImportedStoreJson returns null for invalid JSON text', async () => {
  const { parseImportedStoreJson } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  assert.equal(parseImportedStoreJson('not valid json'), null);
  assert.equal(parseImportedStoreJson(''), null);
});

test('parseImportedStoreJson returns null for a JSON value with no sequences or segments', async () => {
  const { parseImportedStoreJson } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  assert.equal(parseImportedStoreJson(JSON.stringify({ random: 'data' })), null);
  assert.equal(parseImportedStoreJson(JSON.stringify(null)), null);
  assert.equal(parseImportedStoreJson(JSON.stringify(42)), null);
});

test('parseImportedStoreJson parses a plain store object without an export wrapper', async () => {
  const { parseImportedStoreJson } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const sequence = makeSequence({ id: 'seq-plain' });
  const parsed = parseImportedStoreJson(JSON.stringify({
    sequences: [sequence],
    selectedSequenceId: sequence.id
  }));
  assert.ok(parsed !== null);
  assert.equal(parsed.sequences[0].id, 'seq-plain');
});

test('createExportPayload includes app name, version, exportedAt and store', async () => {
  const { createExportPayload } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const store = { sequences: [], selectedSequenceId: null };
  const payload = createExportPayload(store, '2024-01-01T00:00:00.000Z');

  assert.equal(payload.app, 'SnackTape');
  assert.equal(payload.version, 1);
  assert.equal(payload.exportedAt, '2024-01-01T00:00:00.000Z');
  assert.equal(payload.store, store);
});

test('summarizeImport counts imported tapes, clips, duplicate names, and duplicate ranges', async () => {
  const { summarizeImport } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const currentSegment = makeSegment({
    id: 'clip-current',
    videoId: 'video-a',
    startSeconds: 10,
    endSeconds: 15
  });
  const importedDuplicateRange = makeSegment({
    id: 'clip-import-duplicate-range',
    videoId: 'video-a',
    startSeconds: 10,
    endSeconds: 15
  });
  const importedUniqueRange = makeSegment({
    id: 'clip-import-unique-range',
    videoId: 'video-b',
    startSeconds: 20,
    endSeconds: 25
  });
  const current = {
    sequences: [makeSequence({ id: 'seq-current', name: 'Sleep Tape', segments: [currentSegment] })],
    selectedSequenceId: 'seq-current'
  };
  const imported = {
    sequences: [
      makeSequence({ id: 'seq-import-1', name: 'Sleep Tape', segments: [importedDuplicateRange] }),
      makeSequence({ id: 'seq-import-2', name: 'Fresh Tape', segments: [importedUniqueRange] })
    ],
    selectedSequenceId: 'seq-import-1'
  };

  assert.deepEqual(summarizeImport(current, imported), {
    tapeCount: 2,
    clipCount: 2,
    duplicateNameCount: 1,
    duplicateRangeCount: 1
  });
});

test('mergeImportedStore keeps current data and renames imported conflicts', async () => {
  const { mergeImportedStore } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const currentSegment = makeSegment({ id: 'clip-shared', title: 'Current clip' });
  const importedSegment = makeSegment({ id: 'clip-shared', title: 'Imported clip' });
  const current = {
    sequences: [makeSequence({ id: 'seq-shared', name: 'Focus Tape', segments: [currentSegment] })],
    selectedSequenceId: 'seq-shared'
  };
  const imported = {
    sequences: [makeSequence({ id: 'seq-shared', name: 'Focus Tape', segments: [importedSegment] })],
    selectedSequenceId: 'seq-shared'
  };

  const merged = mergeImportedStore(current, imported);

  assert.equal(merged.selectedSequenceId, 'seq-shared');
  assert.equal(merged.sequences.length, 2);
  assert.equal(merged.sequences[0].id, 'seq-shared');
  assert.equal(merged.sequences[0].name, 'Focus Tape');
  assert.notEqual(merged.sequences[1].id, 'seq-shared');
  assert.match(merged.sequences[1].name, /^Focus Tape \(Imported 2\)$/);
  assert.notEqual(merged.sequences[1].segments[0].id, 'clip-shared');
  assert.equal(merged.sequences[1].segments[0].title, 'Imported clip');
});

test('mergeImportedStore preserves the imported selection when merging into an empty library', async () => {
  const { mergeImportedStore } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const first = makeSequence({ id: 'seq-first', name: 'First Imported', segments: [] });
  const selected = makeSequence({ id: 'seq-selected', name: '', segments: [] });

  const merged = mergeImportedStore(
    { sequences: [], selectedSequenceId: null },
    { sequences: [first, selected], selectedSequenceId: selected.id }
  );

  assert.equal(merged.selectedSequenceId, selected.id);
  assert.equal(merged.sequences[1].name, 'Imported Mixtape');
});

test('createExportFilename differentiates exports inside the same minute', async () => {
  const { createExportFilename } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const store = {
    sequences: [
      { id: 'selected', name: 'Export Tape', segments: [], createdAt: 1, updatedAt: 1 }
    ],
    selectedSequenceId: 'selected'
  };

  const first = createExportFilename(store, 'json', new Date(2026, 4, 12, 21, 7, 8, 9));
  const second = createExportFilename(store, 'json', new Date(2026, 4, 12, 21, 7, 9, 10));

  assert.equal(first, 'snacktape-json-20260512-210708-009-export-tape.json');
  assert.equal(second, 'snacktape-json-20260512-210709-010-export-tape.json');
  assert.notEqual(first, second);
});

test('createExportFilename can name a backup after an explicit target tape', async () => {
  const { createExportFilename } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const store = {
    sequences: [
      { id: 'delete', name: 'Delete Tape', segments: [], createdAt: 1, updatedAt: 1 },
      { id: 'selected', name: 'Selected Tape', segments: [], createdAt: 1, updatedAt: 1 }
    ],
    selectedSequenceId: 'selected'
  };

  assert.equal(
    createExportFilename(store, 'json', new Date(2026, 4, 12, 21, 7, 8, 9), { targetSequenceId: 'delete' }),
    'snacktape-json-20260512-210708-009-delete-tape.json'
  );
  assert.equal(
    createExportFilename(store, 'json', new Date(2026, 4, 12, 21, 7, 8, 9), { library: true }),
    'snacktape-json-20260512-210708-009-library.json'
  );
});

test('createExportFilename includes format, local date, and a safe selected tape slug', async () => {
  const { createExportFilename } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const store = {
    sequences: [
      { id: 'first', name: '첫 믹스테이프', segments: [], createdAt: 1, updatedAt: 1 },
      { id: 'selected', name: 'ASMR 조각 모음!', segments: [], createdAt: 1, updatedAt: 1 }
    ],
    selectedSequenceId: 'selected'
  };

  assert.equal(
    createExportFilename(store, 'json', new Date(2026, 4, 12, 21, 7, 8, 9)),
    'snacktape-json-20260512-210708-009-asmr.json'
  );
  assert.equal(
    createExportFilename({ sequences: [store.sequences[0]], selectedSequenceId: 'first' }, 'csv', new Date(2026, 4, 12, 21, 7, 8, 9)),
    'snacktape-csv-20260512-210708-009-mixtape.csv'
  );
});
