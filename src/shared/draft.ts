import type { SegmentDraft } from './types.js';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalSeconds(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 'invalid';
  }

  return Math.round(value * 100) / 100;
}

export function normalizeSegmentDraft(input: unknown): SegmentDraft | null {
  if (!isRecord(input) || typeof input.videoId !== 'string' || !input.videoId.trim()) {
    return null;
  }

  const startSeconds = optionalSeconds(input.startSeconds);
  const endSeconds = optionalSeconds(input.endSeconds);

  if (startSeconds === 'invalid' || endSeconds === 'invalid') {
    return null;
  }

  if (startSeconds === null && endSeconds === null) {
    return null;
  }

  if (startSeconds !== null && endSeconds !== null && endSeconds <= startSeconds) {
    return null;
  }

  const updatedAt =
    typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt) && input.updatedAt > 0
      ? input.updatedAt
      : Date.now();

  return {
    videoId: input.videoId.trim(),
    startSeconds,
    endSeconds,
    updatedAt
  };
}
