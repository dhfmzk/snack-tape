import { normalizeSegmentDraft } from './draft.js';
import type { PlaybackState, Segment, SegmentDraft, Sequence, SnackTapeStore } from './types.js';

export const STORAGE_KEY = 'snacktape.store.v1';
export const PLAYBACK_STATE_KEY = 'snacktape.playback.v1';
export const PLAYBACK_STATE_LOCAL_FALLBACK_KEY = 'snacktape.playback.localFallback.v1';
export const SEGMENT_DRAFT_KEY = 'snacktape.segmentDraft.v1';
export const SEGMENT_DRAFT_LOCAL_FALLBACK_KEY = 'snacktape.segmentDraft.localFallback.v1';

const DEFAULT_SEQUENCE_NAME = '내 첫 믹스테이프';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): number {
  return Date.now();
}

export function createDefaultSequence(): Sequence {
  const timestamp = now();
  return {
    id: createId('sequence'),
    name: DEFAULT_SEQUENCE_NAME,
    segments: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function timestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function seconds(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}

function endSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.floor(value);
}

export function normalizeSegment(input: unknown, index = 0): Segment | null {
  if (!isRecord(input)) {
    return null;
  }

  const videoId = text(input.videoId, '');
  if (!videoId) {
    return null;
  }

  const timestampValue = now();
  const title = text(input.title, `영상 ${videoId}`);

  return {
    id: text(input.id, createId('segment')),
    videoId,
    originalUrl: text(input.originalUrl, `https://www.youtube.com/watch?v=${videoId}`),
    title: title || `영상 ${videoId}`,
    startSeconds: seconds(input.startSeconds, 0),
    endSeconds: endSeconds(input.endSeconds),
    note: typeof input.note === 'string' ? input.note : undefined,
    createdAt: timestamp(input.createdAt, timestampValue + index),
    updatedAt: timestamp(input.updatedAt, timestampValue + index)
  };
}

export function normalizeSequence(input: unknown, index = 0): Sequence | null {
  if (!isRecord(input)) {
    return null;
  }

  const timestampValue = now();
  const segments = Array.isArray(input.segments)
    ? input.segments.map((segment, segmentIndex) => normalizeSegment(segment, segmentIndex)).filter((segment): segment is Segment => segment !== null)
    : [];

  return {
    id: text(input.id, createId('sequence')),
    name: text(input.name, index === 0 ? DEFAULT_SEQUENCE_NAME : `믹스테이프 ${index + 1}`),
    segments,
    createdAt: timestamp(input.createdAt, timestampValue + index),
    updatedAt: timestamp(input.updatedAt, timestampValue + index)
  };
}

export function normalizeStore(input: unknown): SnackTapeStore {
  const defaultSequence = createDefaultSequence();

  if (!isRecord(input)) {
    return {
      sequences: [defaultSequence],
      selectedSequenceId: defaultSequence.id
    };
  }

  const sequences = Array.isArray(input.sequences)
    ? input.sequences.map((sequence, index) => normalizeSequence(sequence, index)).filter((sequence): sequence is Sequence => sequence !== null)
    : [];

  const normalizedSequences = sequences.length > 0 ? sequences : [defaultSequence];
  const requestedSelectedId = typeof input.selectedSequenceId === 'string' ? input.selectedSequenceId : null;
  const selectedSequenceId = normalizedSequences.some((sequence) => sequence.id === requestedSelectedId)
    ? requestedSelectedId
    : normalizedSequences[0].id;

  return {
    sequences: normalizedSequences,
    selectedSequenceId
  };
}

export function normalizeImportedStore(input: unknown): SnackTapeStore | null {
  if (isRecord(input) && Array.isArray(input.sequences)) {
    return normalizeStore(input);
  }

  if (isRecord(input) && Array.isArray(input.segments)) {
    const sequence = normalizeSequence(input);
    if (!sequence) {
      return null;
    }

    return {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    };
  }

  return null;
}

function storageGet(area: chrome.storage.StorageArea, key: string): Promise<unknown> {
  return new Promise((resolve) => {
    area.get(key, (result) => {
      resolve(result[key]);
    });
  });
}

function storageSet(area: chrome.storage.StorageArea, value: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    area.set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function storageRemove(area: chrome.storage.StorageArea, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    area.remove(key, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

export async function loadStore(): Promise<SnackTapeStore> {
  const raw = await storageGet(chrome.storage.local, STORAGE_KEY);
  const store = normalizeStore(raw);

  if (!raw) {
    await saveStore(store);
  }

  return store;
}

export async function saveStore(store: SnackTapeStore): Promise<void> {
  await storageSet(chrome.storage.local, {
    [STORAGE_KEY]: normalizeStore(store)
  });
}

export async function getSelectedSequence(): Promise<Sequence | null> {
  const store = await loadStore();
  return store.sequences.find((sequence) => sequence.id === store.selectedSequenceId) ?? null;
}

export async function upsertSequence(sequence: Sequence): Promise<void> {
  const store = await loadStore();
  const existingIndex = store.sequences.findIndex((item) => item.id === sequence.id);
  const normalized = normalizeSequence(sequence);

  if (!normalized) {
    throw new Error('시퀀스 데이터를 저장할 수 없습니다.');
  }

  if (existingIndex >= 0) {
    store.sequences[existingIndex] = normalized;
  } else {
    store.sequences.push(normalized);
  }

  if (!store.selectedSequenceId) {
    store.selectedSequenceId = normalized.id;
  }

  await saveStore(store);
}

export async function deleteSequence(sequenceId: string): Promise<void> {
  const store = await loadStore();
  const nextSequences = store.sequences.filter((sequence) => sequence.id !== sequenceId);

  if (nextSequences.length === 0) {
    const defaultSequence = createDefaultSequence();
    await saveStore({
      sequences: [defaultSequence],
      selectedSequenceId: defaultSequence.id
    });
    return;
  }

  await saveStore({
    sequences: nextSequences,
    selectedSequenceId: store.selectedSequenceId === sequenceId ? nextSequences[0].id : store.selectedSequenceId
  });
}

export async function selectSequence(sequenceId: string): Promise<void> {
  const store = await loadStore();
  const exists = store.sequences.some((sequence) => sequence.id === sequenceId);

  if (!exists) {
    throw new Error('선택할 시퀀스를 찾을 수 없습니다.');
  }

  await saveStore({
    ...store,
    selectedSequenceId: sequenceId
  });
}

function sessionStorageArea(): chrome.storage.StorageArea | null {
  return chrome.storage.session ?? null;
}

function transientStorageArea(): chrome.storage.StorageArea {
  return sessionStorageArea() ?? chrome.storage.local;
}

export async function loadPlaybackState(): Promise<PlaybackState | null> {
  const session = sessionStorageArea();
  const raw = session
    ? await storageGet(session, PLAYBACK_STATE_KEY)
    : await storageGet(chrome.storage.local, PLAYBACK_STATE_LOCAL_FALLBACK_KEY);

  return isRecord(raw) ? (raw as PlaybackState) : null;
}

export async function savePlaybackState(state: PlaybackState): Promise<void> {
  const session = sessionStorageArea();
  if (session) {
    await storageSet(session, { [PLAYBACK_STATE_KEY]: state });
    return;
  }

  await storageSet(chrome.storage.local, { [PLAYBACK_STATE_LOCAL_FALLBACK_KEY]: state });
}

export async function clearPlaybackState(): Promise<void> {
  const session = sessionStorageArea();
  if (session) {
    await storageRemove(session, PLAYBACK_STATE_KEY);
    return;
  }

  await storageRemove(chrome.storage.local, PLAYBACK_STATE_LOCAL_FALLBACK_KEY);
}

function draftStorageKey(): string {
  return sessionStorageArea() ? SEGMENT_DRAFT_KEY : SEGMENT_DRAFT_LOCAL_FALLBACK_KEY;
}

export async function loadSegmentDraft(videoId: string): Promise<SegmentDraft | null> {
  const raw = await storageGet(transientStorageArea(), draftStorageKey());
  const draft = normalizeSegmentDraft(raw);
  if (!draft || draft.videoId !== videoId) {
    return null;
  }

  return draft;
}

export async function saveSegmentDraft(draft: SegmentDraft): Promise<void> {
  const normalized = normalizeSegmentDraft(draft);
  if (!normalized) {
    throw new Error('임시 구간을 저장할 수 없습니다.');
  }

  await storageSet(transientStorageArea(), {
    [draftStorageKey()]: normalized
  });
}

export async function clearSegmentDraft(videoId?: string): Promise<void> {
  if (!videoId) {
    await storageRemove(transientStorageArea(), draftStorageKey());
    return;
  }

  const draft = await loadSegmentDraft(videoId);
  if (draft) {
    await storageRemove(transientStorageArea(), draftStorageKey());
  }
}
