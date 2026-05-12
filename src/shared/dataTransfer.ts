import { createId, normalizeImportedStore } from './storage.js';
import type { Segment, Sequence, SnackTapeStore } from './types.js';

export type ExportFormat = 'json' | 'csv';
export type ImportSummary = {
  mixtapeCount: number;
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

function segmentRangeKey(segment: Segment): string {
  return `${segment.videoId}:${segment.startSeconds}:${segment.endSeconds ?? 'end'}`;
}

function uniqueName(baseName: string, usedNames: Set<string>): string {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  const importedName = `${baseName} Imported`;
  if (!usedNames.has(importedName)) {
    usedNames.add(importedName);
    return importedName;
  }

  for (let index = 2; index < usedNames.size + 10; index += 1) {
    const candidate = `${importedName} ${index}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }

  const fallback = `${importedName} ${Date.now()}`;
  usedNames.add(fallback);
  return fallback;
}

function uniqueId(baseId: string, usedIds: Set<string>, prefix: string): string {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }

  let candidate = createId(prefix);
  while (usedIds.has(candidate)) {
    candidate = createId(prefix);
  }
  usedIds.add(candidate);
  return candidate;
}

export function summarizeImport(current: SnackTapeStore, imported: SnackTapeStore): ImportSummary {
  const currentNames = new Set(current.sequences.map((sequence) => sequence.name));
  const currentRanges = new Set(current.sequences.flatMap((sequence) => sequence.segments.map(segmentRangeKey)));
  const importedSegments = imported.sequences.flatMap((sequence) => sequence.segments);

  return {
    mixtapeCount: imported.sequences.length,
    clipCount: importedSegments.length,
    duplicateNameCount: imported.sequences.filter((sequence) => currentNames.has(sequence.name)).length,
    duplicateRangeCount: importedSegments.filter((segment) => currentRanges.has(segmentRangeKey(segment))).length,
  };
}

export function mergeImportedStore(current: SnackTapeStore, imported: SnackTapeStore): SnackTapeStore {
  const usedSequenceIds = new Set(current.sequences.map((sequence) => sequence.id));
  const usedSegmentIds = new Set(current.sequences.flatMap((sequence) => sequence.segments.map((segment) => segment.id)));
  const usedNames = new Set(current.sequences.map((sequence) => sequence.name));
  const importedSequences: Sequence[] = imported.sequences.map((sequence) => {
    const id = uniqueId(sequence.id, usedSequenceIds, 'sequence');
    const name = uniqueName(sequence.name, usedNames);
    const segments = sequence.segments.map((segment) => ({
      ...segment,
      id: uniqueId(segment.id, usedSegmentIds, 'clip'),
    }));
    return {
      ...sequence,
      id,
      name,
      segments,
    };
  });

  return {
    sequences: [...current.sequences, ...importedSequences],
    selectedSequenceId: current.selectedSequenceId ?? importedSequences[0]?.id ?? null,
  };
}
