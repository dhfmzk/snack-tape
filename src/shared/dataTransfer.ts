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

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function localDateStamp(date: Date): string {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-') + '-' + [
    padDatePart(date.getHours()),
    padDatePart(date.getMinutes()),
    padDatePart(date.getSeconds()),
  ].join('');
}

function filenameSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
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

export function createExportFilename(format: ExportFormat, language: string, date = new Date()): string {
  return `snacktape-${format}-${localDateStamp(date)}-${filenameSlug(language)}.${format}`;
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
