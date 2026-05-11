import { normalizeImportedStore } from './storage.js';
import type { Segment, SnackTapeStore } from './types.js';

export type ExportFormat = 'json' | 'csv';

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

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

function localDateStamp(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function slugifyFilePart(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');

  return slug || 'mixtape';
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

export type ExportFilenameContext = {
  targetSequenceId?: string | null;
  library?: boolean;
};

function exportFilenameSequence(store: SnackTapeStore, context: ExportFilenameContext): SnackTapeStore['sequences'][number] | null {
  if (context.library) {
    return null;
  }

  if (context.targetSequenceId !== undefined) {
    return store.sequences.find((sequence) => sequence.id === context.targetSequenceId) ?? null;
  }

  return store.sequences.find((sequence) => sequence.id === store.selectedSequenceId) ?? store.sequences[0] ?? null;
}

export function createExportFilename(store: SnackTapeStore, format: ExportFormat, exportedAt = new Date(), context: ExportFilenameContext = {}): string {
  const sequence = exportFilenameSequence(store, context);
  const tapeSlug = slugifyFilePart(sequence?.name ?? 'library');
  return `snacktape-${format}-${localDateStamp(exportedAt)}-${tapeSlug}.${format}`;
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
