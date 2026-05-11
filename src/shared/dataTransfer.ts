import { createId, normalizeImportedStore } from './storage.js';
import type { Segment, Sequence, SnackTapeStore } from './types.js';

export type ExportFormat = 'json' | 'csv';
export type ImportPreviewSummary = {
  tapeCount: number;
  clipCount: number;
  duplicateNameCount: number;
  duplicateRangeCount: number;
};

type ExportPayload = {
  app: 'SnackTape';
  version: 1;
  exportedAt: string;
  store: SnackTapeStore;
};

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function segmentRows(store: SnackTapeStore): Array<{ sequenceName: string; segment: Segment }> {
  return store.sequences.flatMap((sequence) =>
    sequence.segments.map((segment) => ({
      sequenceName: sequence.name,
      segment,
    }))
  );
}

function rangeIdentity(segment: Segment): string {
  return [segment.videoId, segment.startSeconds, segment.endSeconds ?? 'END'].join('\u0000');
}

function uniqueName(name: string, usedNames: Set<string>): string {
  const baseName = name.trim() || 'Imported Tape';
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${baseName} (Imported ${index})`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }

  const fallback = `${baseName} (Imported ${Date.now()})`;
  usedNames.add(fallback);
  return fallback;
}

function uniqueId(id: string, usedIds: Set<string>, prefix: 'clip' | 'sequence'): string {
  if (!usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }

  let candidate = createId(prefix);
  while (usedIds.has(candidate)) {
    candidate = createId(prefix);
  }
  usedIds.add(candidate);
  return candidate;
}

export function createExportPayload(store: SnackTapeStore, exportedAt = new Date().toISOString()): ExportPayload {
  return {
    app: 'SnackTape',
    version: 1,
    exportedAt,
    store,
  };
}

export function serializeStoreJson(store: SnackTapeStore): string {
  return JSON.stringify(createExportPayload(store), null, 2);
}

export function summarizeImport(currentStore: SnackTapeStore, importedStore: SnackTapeStore): ImportPreviewSummary {
  const currentNames = new Set(currentStore.sequences.map((sequence) => sequence.name.trim()).filter(Boolean));
  const currentRanges = new Set(currentStore.sequences.flatMap((sequence) => sequence.segments.map(rangeIdentity)));

  return {
    tapeCount: importedStore.sequences.length,
    clipCount: importedStore.sequences.reduce((total, sequence) => total + sequence.segments.length, 0),
    duplicateNameCount: importedStore.sequences.filter((sequence) => currentNames.has(sequence.name.trim())).length,
    duplicateRangeCount: importedStore.sequences.reduce(
      (total, sequence) => total + sequence.segments.filter((segment) => currentRanges.has(rangeIdentity(segment))).length,
      0
    ),
  };
}

export function mergeImportedStore(currentStore: SnackTapeStore, importedStore: SnackTapeStore): SnackTapeStore {
  const usedSequenceIds = new Set(currentStore.sequences.map((sequence) => sequence.id));
  const usedSegmentIds = new Set(currentStore.sequences.flatMap((sequence) => sequence.segments.map((segment) => segment.id)));
  const usedNames = new Set(currentStore.sequences.map((sequence) => sequence.name.trim()).filter(Boolean));
  const importedSequences: Sequence[] = importedStore.sequences.map((sequence) => ({
    ...sequence,
    id: uniqueId(sequence.id, usedSequenceIds, 'sequence'),
    name: uniqueName(sequence.name, usedNames),
    segments: sequence.segments.map((segment) => ({
      ...segment,
      id: uniqueId(segment.id, usedSegmentIds, 'clip'),
    })),
  }));
  const sequences = [
    ...currentStore.sequences.map((sequence) => ({
      ...sequence,
      segments: sequence.segments.map((segment) => ({ ...segment })),
    })),
    ...importedSequences,
  ];

  return {
    sequences,
    selectedSequenceId: currentStore.selectedSequenceId ?? sequences[0]?.id ?? null,
  };
}

export function serializeStoreCsv(store: SnackTapeStore): string {
  const header = [
    'mixtape',
    'title',
    'videoId',
    'originalUrl',
    'startSeconds',
    'endSeconds',
    'note',
    'createdAt',
    'updatedAt',
  ];
  const rows = segmentRows(store).map(({ sequenceName, segment }) => [
    sequenceName,
    segment.title,
    segment.videoId,
    segment.originalUrl,
    segment.startSeconds,
    segment.endSeconds ?? '',
    segment.note ?? '',
    segment.createdAt,
    segment.updatedAt,
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function parseImportedStoreJson(text: string): SnackTapeStore | null {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'store' in payload) {
    return normalizeImportedStore((payload as { store?: unknown }).store);
  }

  return normalizeImportedStore(payload);
}
