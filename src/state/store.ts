import { describePlaybackState, playbackStateAfterSequenceEdit, type PlaybackDisplayState } from '../shared/playback.js';
import { moveItem, removeSegmentFromSequence } from '../shared/reorder.js';
import { createExportFilename, parseImportedStoreJson, serializeStoreCsv, serializeStoreJson, type ExportFilenameContext, type ExportFormat } from '../shared/dataTransfer.js';
import {
  clearPlaybackState,
  clearSegmentDraft,
  createId,
  loadPlaybackState,
  loadSegmentDraft,
  loadStore,
  savePlaybackState,
  saveStore,
  saveSegmentDraft,
} from '../shared/storage.js';
import type { PageInfo, PlaybackMode, PlaybackState, Segment, Sequence, SnackTapeErrorCode, SnackTapeMessage, SnackTapeResponse, SnackTapeStore, VideoState } from '../shared/types.js';
import { validateSegment, validateSequence } from '../shared/validation.js';
import { parseTimecodeToSeconds } from '../shared/time.js';
import { createI18n, type I18n } from '../i18n.js';
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings, type Settings } from './storage.js';
import { getActiveVideoState, getPlaybackPageInfo, sendRuntimeMessage, type ActiveVideoResult } from './youtube.js';

export type AppRoute = 'home' | 'capture' | 'playback' | 'settings' | 'detail';
export type HomeSort = 'manual' | 'updated' | 'name' | 'clipCount';

export type QueueEditState = {
  sequenceId: string;
  segmentIds: string[];
  baseSegmentIds: string[];
};

export type SegmentEditEdge = 'start' | 'end';

export type SegmentEditState = {
  segmentId: string;
};

export type RenameEditState = {
  sequenceId: string;
};

export type CaptureNotice = {
  kind: 'error' | 'info';
  message: string;
};

export type SettingsNotice = {
  kind: 'error' | 'info';
  message: string;
};

export type PlaybackRecoveryAction =
  | {
      type: 'start';
      sequenceId: string;
      startIndex: number;
      mode?: PlaybackMode;
      orderSegmentIds?: string[];
      queueEdited?: boolean;
    }
  | { type: 'next' }
  | { type: 'stop' };

export type PlaybackNotice = {
  kind: 'error' | 'info';
  message: string;
  recovery?: PlaybackRecoveryAction;
};

export type AppState = {
  route: AppRoute;
  store: SnackTapeStore | null;
  settings: Settings;
  pageInfo: PageInfo | null;
  videoState: VideoState | null;
  playbackState: PlaybackState | null;
  playbackDisplay: PlaybackDisplayState | null;
  playbackNotice: PlaybackNotice | null;
  draftIn: number | null;
  draftOut: number | null;
  capturePulseId: string | null;
  queueEdit: QueueEditState | null;
  segmentEdit: SegmentEditState | null;
  renameEdit: RenameEditState | null;
  captureNotice: CaptureNotice | null;
  settingsNotice: SettingsNotice | null;
  homeSearch: string;
  homeSort: HomeSort;
  editSearch: string;
  loading: boolean;
};

export type AppListener = (state: AppState) => void;
type PersistenceNoticeTarget = 'capture' | 'settings';
export type ExportDataOptions = ExportFilenameContext;

function selectedSequenceFrom(store: SnackTapeStore | null): Sequence | null {
  if (!store) {
    return null;
  }

  return store.sequences.find((sequence) => sequence.id === store.selectedSequenceId) ?? store.sequences[0] ?? null;
}

function sequenceSegmentIds(sequence: Sequence): string[] {
  return sequence.segments.map((segment) => segment.id);
}

function existingUniqueSegmentIds(sequence: Sequence, segmentIds: string[]): string[] {
  const existingIds = new Set(sequenceSegmentIds(sequence));
  const seen = new Set<string>();
  const nextIds: string[] = [];

  for (const segmentId of segmentIds) {
    if (!existingIds.has(segmentId) || seen.has(segmentId)) {
      continue;
    }
    seen.add(segmentId);
    nextIds.push(segmentId);
  }

  return nextIds;
}

function playbackQueueIds(sequence: Sequence, playbackState: PlaybackState | null): string[] {
  const baseIds = sequenceSegmentIds(sequence);
  if (playbackState?.sequenceId !== sequence.id || !playbackState.orderSegmentIds?.length) {
    return baseIds;
  }

  const queuedIds = existingUniqueSegmentIds(sequence, playbackState.orderSegmentIds);
  if (playbackState.queueEdited) {
    return queuedIds;
  }

  const queuedSet = new Set(queuedIds);
  const missingIds = baseIds.filter((segmentId) => !queuedSet.has(segmentId));
  return [...queuedIds, ...missingIds];
}

function playbackStateAfterQueueEdit(state: PlaybackState, sequence: Sequence, segmentIds: string[]): PlaybackState | null {
  const orderSegmentIds = existingUniqueSegmentIds(sequence, segmentIds);
  if (orderSegmentIds.length === 0) {
    return null;
  }

  const fallbackCurrentId = sequence.segments[state.segmentIndex]?.id;
  const currentSegmentId = state.currentSegmentId && orderSegmentIds.includes(state.currentSegmentId)
    ? state.currentSegmentId
    : fallbackCurrentId && orderSegmentIds.includes(fallbackCurrentId)
      ? fallbackCurrentId
      : orderSegmentIds[0];
  const segmentIndex = sequence.segments.findIndex((segment) => segment.id === currentSegmentId);
  const order = orderSegmentIds
    .map((segmentId) => sequence.segments.findIndex((segment) => segment.id === segmentId))
    .filter((index) => index >= 0);

  return {
    ...state,
    currentSegmentId,
    segmentIndex: segmentIndex >= 0 ? segmentIndex : 0,
    mode: state.mode ?? 'sequence',
    order,
    orderSegmentIds,
    orderPosition: Math.max(0, orderSegmentIds.findIndex((segmentId) => segmentId === currentSegmentId)),
    queueEdited: true,
  };
}

function preciseTime(value: number): number {
  return value;
}

function nextNumberedName(baseName: string, sequences: Sequence[]): string {
  const used = new Set(sequences.map((sequence) => sequence.name.trim()));
  for (let index = 1; index <= sequences.length + 1; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return `${baseName} ${sequences.length + 1}`;
}

function uniqueName(baseName: string, sequences: Sequence[]): string {
  const used = new Set(sequences.map((sequence) => sequence.name.trim()));
  const trimmed = baseName.trim();
  if (!used.has(trimmed)) {
    return trimmed;
  }

  for (let index = 2; index <= sequences.length + 2; index += 1) {
    const candidate = `${trimmed} ${index}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return `${trimmed} ${sequences.length + 2}`;
}

function cloneSegment(segment: Segment, timestamp: number, preserveId = false): Segment {
  return {
    ...segment,
    id: preserveId ? segment.id : createId('clip'),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function cloneSegments(segments: Segment[], timestamp: number): Segment[] {
  return segments.map((segment) => cloneSegment(segment, timestamp));
}

type CaptureReadyPageInfo = PageInfo & {
  videoId: string;
  currentTime: number;
};

type CaptureSaveMetadataPageInfo = PageInfo & {
  videoId: string;
};

function captureReadyPageInfo(pageInfo: PageInfo | null | undefined): CaptureReadyPageInfo | null {
  if (
    pageInfo?.isYouTubeVideoPage
    && pageInfo.videoId
    && pageInfo.currentTime !== null
    && pageInfo.currentTime !== undefined
  ) {
    return pageInfo as CaptureReadyPageInfo;
  }

  return null;
}

function captureSaveMetadataPageInfo(pageInfo: PageInfo | null | undefined): CaptureSaveMetadataPageInfo | null {
  if (
    pageInfo?.isYouTubeVideoPage
    && pageInfo.videoId
    && pageInfo.url
    && typeof pageInfo.title === 'string'
  ) {
    return pageInfo as CaptureSaveMetadataPageInfo;
  }

  return null;
}

const MIN_CAPTURE_DURATION_SECONDS = 1 / 30;

function samePageInfo(left: PageInfo | null, right: PageInfo | null): boolean {
  return left?.isYouTubeVideoPage === right?.isYouTubeVideoPage
    && left?.videoId === right?.videoId
    && left?.title === right?.title
    && left?.url === right?.url
    && left?.currentTime === right?.currentTime
    && left?.duration === right?.duration;
}

function sameVideoState(left: VideoState | null, right: VideoState | null): boolean {
  return left?.videoId === right?.videoId
    && left?.title === right?.title
    && left?.channel === right?.channel
    && left?.currentTime === right?.currentTime
    && left?.duration === right?.duration
    && left?.paused === right?.paused;
}

export class SnackTapeAppStore {
  private state: AppState;
  private listeners = new Set<AppListener>();

  constructor() {
    this.state = {
      route: 'home',
      store: null,
      settings: { ...DEFAULT_SETTINGS },
      pageInfo: null,
      videoState: null,
      playbackState: null,
      playbackDisplay: null,
      playbackNotice: null,
      draftIn: null,
      draftOut: null,
      capturePulseId: null,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      captureNotice: null,
      settingsNotice: null,
      homeSearch: '',
      homeSort: 'manual',
      editSearch: '',
      loading: true,
    };
  }

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: AppListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  selectedSequence(): Sequence | null {
    return selectedSequenceFrom(this.state.store);
  }

  private setState(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private noticeTargetForRoute(route: AppRoute): PersistenceNoticeTarget {
    return route === 'capture' ? 'capture' : 'settings';
  }

  private persistenceErrorMessage(error: unknown, state: AppState): string {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
    return createI18n(state.settings?.language).common.saveFailed(message);
  }

  private restoreAfterPersistenceError(previousState: AppState, target: PersistenceNoticeTarget, error: unknown): void {
    const notice = {
      kind: 'error',
      message: this.persistenceErrorMessage(error, previousState),
    } as const;

    this.setState({
      ...previousState,
      captureNotice: target === 'capture' ? notice : previousState.captureNotice ?? null,
      settingsNotice: target === 'settings' ? notice : previousState.settingsNotice ?? null,
    });
  }

  private async persistOrRollback(
    previousState: AppState,
    target: PersistenceNoticeTarget,
    persist: () => Promise<void>
  ): Promise<boolean> {
    try {
      await persist();
      return true;
    } catch (error) {
      this.restoreAfterPersistenceError(previousState, target, error);
      return false;
    }
  }

  private playbackRuntimeErrorMessage(error: unknown, errorCode: SnackTapeErrorCode | undefined, i18n: I18n): string {
    if (errorCode === 'content_request_failed') {
      return i18n.playback.contentRequestFailed;
    }
    if (errorCode === 'runtime_unavailable') {
      return i18n.playback.runtimeUnavailable;
    }
    if (errorCode === 'unsupported_request') {
      return i18n.playback.unsupportedRequest;
    }

    const rawMessage = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
    if (!rawMessage || (errorCode === 'unknown' && rawMessage === 'Unknown playback error')) {
      return i18n.playback.unknownError;
    }

    return rawMessage;
  }

  private playbackFailedMessage(
    response: Pick<SnackTapeResponse, 'error' | 'errorCode'>,
    compose: (i18n: I18n, message: string) => string
  ): string {
    const i18n = createI18n(this.state.settings.language);
    return compose(i18n, this.playbackRuntimeErrorMessage(response.error, response.errorCode, i18n));
  }

  private samePlaybackRecovery(left: PlaybackRecoveryAction | undefined, right: PlaybackRecoveryAction | undefined): boolean {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }

  private setPlaybackError(message: string, recovery?: PlaybackRecoveryAction): void {
    const current = this.state.playbackNotice;
    if (current?.kind === 'error' && current.message === message && this.samePlaybackRecovery(current.recovery, recovery)) {
      return;
    }

    this.setState({ playbackNotice: { kind: 'error', message, recovery } });
  }

  private playbackStartFailedMessage(response: Pick<SnackTapeResponse, 'error' | 'errorCode'>): string {
    return this.playbackFailedMessage(response, (i18n, message) => i18n.playback.startFailed(message));
  }

  private playbackNextFailedMessage(response: Pick<SnackTapeResponse, 'error' | 'errorCode'>): string {
    return this.playbackFailedMessage(response, (i18n, message) => i18n.playback.nextFailed(message));
  }

  private playbackSeekFailedMessage(response: Pick<SnackTapeResponse, 'error' | 'errorCode'>): string {
    return this.playbackFailedMessage(response, (i18n, message) => i18n.playback.seekFailed(message));
  }

  private playbackPauseFailedMessage(response: Pick<SnackTapeResponse, 'error' | 'errorCode'>): string {
    return this.playbackFailedMessage(response, (i18n, message) => i18n.playback.pauseFailed(message));
  }

  private playbackResumeFailedMessage(response: Pick<SnackTapeResponse, 'error' | 'errorCode'>): string {
    return this.playbackFailedMessage(response, (i18n, message) => i18n.playback.resumeFailed(message));
  }

  private playbackStopFailedMessage(response: Pick<SnackTapeResponse, 'error' | 'errorCode'>): string {
    return this.playbackFailedMessage(response, (i18n, message) => i18n.playback.stopFailed(message));
  }

  private recoveryFromPlaybackState(playbackState: PlaybackState | null | undefined): PlaybackRecoveryAction | undefined {
    if (!playbackState?.sequenceId) {
      return undefined;
    }

    const recovery: PlaybackRecoveryAction = {
      type: 'start',
      sequenceId: playbackState.sequenceId,
      startIndex: playbackState.segmentIndex,
      mode: playbackState.mode ?? (this.state.settings.shuffleByDefault ? 'shuffle' : 'sequence'),
    };
    if (playbackState.orderSegmentIds?.length) {
      recovery.orderSegmentIds = playbackState.orderSegmentIds;
    }
    if (playbackState.queueEdited) {
      recovery.queueEdited = true;
    }

    return recovery;
  }

  async init(): Promise<void> {
    const [store, settings] = await Promise.all([loadStore(), loadSettings()]);
    this.setState({ store, settings, loading: false });
    await this.refreshVideo();
    await this.restoreDraft();
    await this.refreshPlayback();

    if (this.state.pageInfo?.isYouTubeVideoPage) {
      this.setRoute('capture');
    }
  }

  setRoute(route: AppRoute): void {
    this.setState({
      route,
      queueEdit: route === 'playback' ? this.state.queueEdit : null,
      segmentEdit: route === 'capture' ? this.state.segmentEdit : null,
      renameEdit: route === 'capture' ? this.state.renameEdit : null,
    });

    if (route === 'capture') {
      void this.syncActiveVideoForCapture();
    }
  }

  setHomeSearch(query: string): void {
    this.setState({ homeSearch: query });
  }

  setHomeSort(sort: HomeSort): void {
    this.setState({ homeSort: sort });
  }

  setEditSearch(query: string): void {
    this.setState({ editSearch: query });
  }

  async createMixtape(): Promise<void> {
    const currentStore = this.state.store;
    if (!currentStore) {
      return;
    }
    const previousState = this.state;

    const timestamp = Date.now();
    const sequence: Sequence = {
      id: createId('sequence'),
      name: nextNumberedName(createI18n(this.state.settings.language).common.unnamedMixtape, currentStore.sequences),
      segments: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const store: SnackTapeStore = {
      sequences: [...currentStore.sequences, sequence],
      selectedSequenceId: sequence.id,
    };
    this.setState({ store });
    const persisted = await this.persistOrRollback(previousState, this.noticeTargetForRoute(previousState.route), () => saveStore(store));
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  async duplicateMixtape(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence) {
      return;
    }
    const previousState = this.state;

    const timestamp = Date.now();
    const i18n = createI18n(this.state.settings.language);
    const copy: Sequence = {
      ...sequence,
      id: createId('sequence'),
      name: uniqueName(i18n.common.copyName(sequence.name), currentStore.sequences),
      segments: cloneSegments(sequence.segments, timestamp),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const store: SnackTapeStore = {
      sequences: [...currentStore.sequences, copy],
      selectedSequenceId: copy.id,
    };

    this.setState({ store });
    const persisted = await this.persistOrRollback(previousState, this.noticeTargetForRoute(previousState.route), () => saveStore(store));
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  async openMixtape(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence) {
      return;
    }
    const previousState = this.state;

    const playbackState = this.state.playbackState ?? await loadPlaybackState();
    const clearsPlayback = Boolean(playbackState?.sequenceId && playbackState.sequenceId !== sequenceId);
    const store: SnackTapeStore = {
      ...currentStore,
      selectedSequenceId: sequenceId,
    };
    this.setState({
      route: sequence.segments.length === 0 ? 'capture' : 'playback',
      store,
      playbackState: clearsPlayback ? null : this.state.playbackState,
      playbackDisplay: clearsPlayback ? null : this.state.playbackDisplay,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
    });
    const persisted = await this.persistOrRollback(previousState, this.noticeTargetForRoute(previousState.route), async () => {
      await saveStore(store);
    });
    if (!persisted) {
      return;
    }
    if (clearsPlayback) {
      const response = await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
      if (!response.ok) {
        await clearPlaybackState();
      }
    }
    if (!clearsPlayback) {
      await this.refreshPlayback();
    }
  }

  async editMixtape(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence) {
      return;
    }
    const previousState = this.state;

    const store: SnackTapeStore = {
      ...currentStore,
      selectedSequenceId: sequenceId,
    };
    this.setState({
      route: 'capture',
      store,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
    });
    const persisted = await this.persistOrRollback(previousState, 'capture', () => saveStore(store));
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  async editPlaybackSegment(sequenceId: string, segmentId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence?.segments.some((segment) => segment.id === segmentId)) {
      return;
    }
    const previousState = this.state;

    const store: SnackTapeStore = {
      ...currentStore,
      selectedSequenceId: sequenceId,
    };
    this.setState({
      route: 'capture',
      store,
      queueEdit: null,
      segmentEdit: { segmentId },
      renameEdit: null,
    });
    const persisted = await this.persistOrRollback(previousState, 'capture', () => saveStore(store));
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  async beginRenameMixtape(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence) {
      return;
    }
    const previousState = this.state;

    const store: SnackTapeStore = {
      ...currentStore,
      selectedSequenceId: sequenceId,
    };
    this.setState({
      route: 'capture',
      store,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: { sequenceId },
    });
    const persisted = await this.persistOrRollback(previousState, 'capture', () => saveStore(store));
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  cancelRenameMixtape(): void {
    this.setState({ renameEdit: null });
  }

  async renameMixtape(sequenceId: string, name: string): Promise<void> {
    const nextName = name.trim();
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence || !nextName) {
      return;
    }
    const previousState = this.state;

    const timestamp = Date.now();
    const store: SnackTapeStore = {
      ...currentStore,
      sequences: currentStore.sequences.map((item) =>
        item.id === sequenceId
          ? { ...item, name: nextName, updatedAt: timestamp }
          : item
      ),
    };
    this.setState({
      store,
      renameEdit: this.state.renameEdit?.sequenceId === sequenceId ? null : this.state.renameEdit,
    });
    const persisted = await this.persistOrRollback(previousState, 'capture', () => saveStore(store));
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  async deleteMixtape(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence) {
      return;
    }
    const previousState = this.state;

    const nextSequences = currentStore.sequences.filter((item) => item.id !== sequenceId);
    const store: SnackTapeStore = {
      sequences: nextSequences,
      selectedSequenceId: currentStore.selectedSequenceId === sequenceId ? nextSequences[0]?.id ?? null : currentStore.selectedSequenceId,
    };
    const playbackState = this.state.playbackState ?? await loadPlaybackState();
    const clearsPlayback = playbackState?.sequenceId === sequenceId;
    const clearsDefaultMixtape = this.state.settings.defaultMixtapeId === sequenceId;
    const settings = clearsDefaultMixtape
      ? normalizeSettings({ ...this.state.settings, defaultMixtapeId: undefined })
      : this.state.settings;

    this.setState({
      route: store.sequences.length === 0 ? 'home' : 'capture',
      store,
      settings,
      playbackState: clearsPlayback ? null : this.state.playbackState,
      playbackDisplay: clearsPlayback ? describePlaybackState(store, null) : this.state.playbackDisplay,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      capturePulseId: null,
    });

    const persisted = await this.persistOrRollback(previousState, this.noticeTargetForRoute(previousState.route), async () => {
      await saveStore(store);
      if (clearsDefaultMixtape) {
        await saveSettings(settings);
      }
    });
    if (!persisted) {
      return;
    }

    if (clearsPlayback) {
      const response = await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
      if (!response.ok) {
        await clearPlaybackState();
      }
    }
    await this.refreshPlayback();
  }

  async mergeMixtapeInto(sourceSequenceId: string, targetSequenceId: string): Promise<void> {
    if (sourceSequenceId === targetSequenceId) {
      return;
    }

    const currentStore = this.state.store;
    const source = currentStore?.sequences.find((item) => item.id === sourceSequenceId);
    const target = currentStore?.sequences.find((item) => item.id === targetSequenceId);
    if (!currentStore || !source || !target) {
      return;
    }
    const previousState = this.state;

    const timestamp = Date.now();
    const updatedTarget: Sequence = {
      ...target,
      segments: [...target.segments, ...cloneSegments(source.segments, timestamp)],
      updatedAt: timestamp,
    };
    const nextSequences = currentStore.sequences
      .filter((item) => item.id !== sourceSequenceId)
      .map((item) => (item.id === targetSequenceId ? updatedTarget : item));
    const store: SnackTapeStore = {
      sequences: nextSequences,
      selectedSequenceId: currentStore.selectedSequenceId === sourceSequenceId ? targetSequenceId : currentStore.selectedSequenceId,
    };
    const clearsDefaultMixtape = this.state.settings.defaultMixtapeId === sourceSequenceId;
    const settings = clearsDefaultMixtape
      ? normalizeSettings({ ...this.state.settings, defaultMixtapeId: targetSequenceId })
      : this.state.settings;
    const playbackState = this.state.playbackState ?? await loadPlaybackState();
    const clearsPlayback = playbackState?.sequenceId === sourceSequenceId;
    const nextPlaybackState = clearsPlayback ? null : playbackState ?? null;

    this.setState({
      store,
      settings,
      playbackState: nextPlaybackState,
      playbackDisplay: describePlaybackState(store, nextPlaybackState),
      queueEdit: this.state.queueEdit?.sequenceId === sourceSequenceId ? null : this.state.queueEdit,
      segmentEdit: null,
      renameEdit: this.state.renameEdit?.sequenceId === sourceSequenceId ? null : this.state.renameEdit,
      capturePulseId: null,
    });

    const persisted = await this.persistOrRollback(previousState, this.noticeTargetForRoute(previousState.route), async () => {
      await saveStore(store);
      if (clearsDefaultMixtape) {
        await saveSettings(settings);
      }
    });
    if (!persisted) {
      return;
    }

    if (clearsPlayback) {
      const response = await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
      if (!response.ok) {
        await clearPlaybackState();
      }
    }
    await this.refreshPlayback();
  }

  async selectCaptureTarget(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    if (!currentStore?.sequences.some((sequence) => sequence.id === sequenceId)) {
      return;
    }
    const previousState = this.state;

    const store: SnackTapeStore = {
      ...currentStore,
      selectedSequenceId: sequenceId,
    };
    this.setState({ store, segmentEdit: null, renameEdit: null, editSearch: '' });
    const persisted = await this.persistOrRollback(previousState, 'capture', () => saveStore(store));
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  beginSegmentEdit(segmentId: string): void {
    const sequence = this.selectedSequence();
    if (!sequence?.segments.some((segment) => segment.id === segmentId)) {
      return;
    }

    this.setState({ segmentEdit: { segmentId } });
  }

  cancelSegmentEdit(): void {
    this.setState({ segmentEdit: null });
  }

  async nudgeSegmentTime(segmentId: string, edge: SegmentEditEdge, deltaSeconds: number): Promise<void> {
    const currentStore = this.state.store;
    const sequence = this.selectedSequence();
    if (!currentStore || !sequence || !Number.isFinite(deltaSeconds)) {
      return;
    }
    const previousState = this.state;

    const timestamp = Date.now();
    let changed = false;
    const segments = sequence.segments.map((segment) => {
      if (segment.id !== segmentId) {
        return segment;
      }

      if (edge === 'start') {
        const maxStart = segment.endSeconds === null ? Number.POSITIVE_INFINITY : Math.max(0, segment.endSeconds - 0.01);
        const startSeconds = preciseTime(Math.min(maxStart, Math.max(0, segment.startSeconds + deltaSeconds)));
        changed = startSeconds !== segment.startSeconds;
        return { ...segment, startSeconds, updatedAt: timestamp };
      }

      if (segment.endSeconds === null) {
        return segment;
      }

      const endSeconds = preciseTime(Math.max(segment.startSeconds + MIN_CAPTURE_DURATION_SECONDS, segment.endSeconds + deltaSeconds));
      changed = endSeconds !== segment.endSeconds;
      return { ...segment, endSeconds, updatedAt: timestamp };
    });

    if (!changed) {
      return;
    }

    const updatedSequence: Sequence = {
      ...sequence,
      segments,
      updatedAt: timestamp,
    };
    const editedSegment = updatedSequence.segments.find((segment) => segment.id === segmentId);
    if (!editedSegment || validateSegment(editedSegment).length > 0) {
      return;
    }

    const store: SnackTapeStore = {
      ...currentStore,
      sequences: currentStore.sequences.map((item) => (item.id === updatedSequence.id ? updatedSequence : item)),
    };
    this.setState({ store });
    const persisted = await this.persistOrRollback(previousState, 'capture', () => saveStore(store));
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  async setSegmentTimecode(segmentId: string, edge: SegmentEditEdge, timecode: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = this.selectedSequence();
    if (!currentStore || !sequence) {
      return;
    }

    const i18n = createI18n(this.state.settings.language).capture;
    const seconds = parseTimecodeToSeconds(timecode);
    if (seconds === null || !Number.isFinite(seconds)) {
      this.setCaptureError(i18n.noticeInvalidTimecode);
      return;
    }

    const previousState = this.state;
    const timestamp = Date.now();
    let changed = false;
    let invalidRange = false;
    const segments = sequence.segments.map((segment) => {
      if (segment.id !== segmentId) {
        return segment;
      }

      if (edge === 'start') {
        if (segment.endSeconds !== null && seconds > segment.endSeconds - MIN_CAPTURE_DURATION_SECONDS) {
          invalidRange = true;
          return segment;
        }
        changed = seconds !== segment.startSeconds;
        return { ...segment, startSeconds: seconds, updatedAt: timestamp };
      }

      if (seconds < segment.startSeconds + MIN_CAPTURE_DURATION_SECONDS) {
        invalidRange = true;
        return segment;
      }
      changed = seconds !== segment.endSeconds;
      return { ...segment, endSeconds: seconds, updatedAt: timestamp };
    });

    if (invalidRange) {
      this.setCaptureError(i18n.noticeInvalidRange);
      return;
    }
    if (!changed) {
      return;
    }

    const updatedSequence: Sequence = {
      ...sequence,
      segments,
      updatedAt: timestamp,
    };
    const editedSegment = updatedSequence.segments.find((segment) => segment.id === segmentId);
    if (!editedSegment || validateSegment(editedSegment).length > 0) {
      this.setCaptureError(i18n.noticeInvalidSegment);
      return;
    }

    const store: SnackTapeStore = {
      ...currentStore,
      sequences: currentStore.sequences.map((item) => (item.id === updatedSequence.id ? updatedSequence : item)),
    };
    this.setState({ store, captureNotice: null });
    const persisted = await this.persistOrRollback(previousState, 'capture', () => saveStore(store));
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  async deleteSegmentFromSelected(segmentId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = this.selectedSequence();
    if (!currentStore || !sequence || !sequence.segments.some((segment) => segment.id === segmentId)) {
      return;
    }
    const previousState = this.state;

    const updatedSequence = removeSegmentFromSequence(sequence, segmentId);
    const store: SnackTapeStore = {
      ...currentStore,
      sequences: currentStore.sequences.map((item) => (item.id === updatedSequence.id ? updatedSequence : item)),
    };
    const playbackState = this.state.playbackState;
    let nextPlaybackState: PlaybackState | null = playbackState ?? null;
    if (playbackState?.sequenceId === updatedSequence.id) {
      if (updatedSequence.segments.length === 0 || playbackState.currentSegmentId === segmentId) {
        nextPlaybackState = null;
      } else {
        nextPlaybackState = playbackStateAfterSequenceEdit(playbackState, updatedSequence);
      }
    }

    this.setState({
      store,
      playbackState: nextPlaybackState,
      playbackDisplay: describePlaybackState(store, nextPlaybackState),
      segmentEdit: this.state.segmentEdit?.segmentId === segmentId ? null : this.state.segmentEdit,
    });

    const persisted = await this.persistOrRollback(previousState, 'capture', async () => {
      await saveStore(store);
      if (playbackState?.sequenceId === updatedSequence.id) {
        if (nextPlaybackState) {
          await savePlaybackState(nextPlaybackState);
        }
      }
    });
    if (!persisted) {
      return;
    }
    if (playbackState?.sequenceId === updatedSequence.id && !nextPlaybackState) {
      const response = await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
      if (!response.ok) {
        await clearPlaybackState();
      }
    }
    await this.refreshPlayback();
  }

  async copySegmentToMixtape(segmentId: string, targetSequenceId: string): Promise<void> {
    await this.transferSegmentToMixtape(segmentId, targetSequenceId, 'copy');
  }

  async moveSegmentToMixtape(segmentId: string, targetSequenceId: string): Promise<void> {
    await this.transferSegmentToMixtape(segmentId, targetSequenceId, 'move');
  }

  private async transferSegmentToMixtape(segmentId: string, targetSequenceId: string, mode: 'copy' | 'move'): Promise<void> {
    const currentStore = this.state.store;
    const source = this.selectedSequence();
    const target = currentStore?.sequences.find((item) => item.id === targetSequenceId);
    const segment = source?.segments.find((item) => item.id === segmentId);
    if (!currentStore || !source || !target || !segment) {
      return;
    }
    if (mode === 'move' && source.id === target.id) {
      return;
    }
    const previousState = this.state;

    const timestamp = Date.now();
    const copiedSegment = cloneSegment(segment, timestamp, mode === 'move');
    const updatedSource: Sequence = mode === 'move'
      ? {
          ...source,
          segments: source.segments.filter((item) => item.id !== segmentId),
          updatedAt: timestamp,
        }
      : source;
    const updatedTarget: Sequence = {
      ...target,
      segments: [...target.segments, copiedSegment],
      updatedAt: timestamp,
    };

    const store: SnackTapeStore = {
      ...currentStore,
      sequences: currentStore.sequences.map((item) => {
        if (item.id === target.id) {
          return updatedTarget;
        }
        if (item.id === source.id) {
          return updatedSource;
        }
        return item;
      }),
    };

    const playbackState = this.state.playbackState;
    let nextPlaybackState: PlaybackState | null = playbackState ?? null;
    if (mode === 'move' && playbackState?.sequenceId === source.id) {
      if (updatedSource.segments.length === 0 || playbackState.currentSegmentId === segmentId) {
        nextPlaybackState = null;
      } else {
        nextPlaybackState = playbackStateAfterSequenceEdit(playbackState, updatedSource);
      }
    }

    this.setState({
      store,
      playbackState: nextPlaybackState,
      playbackDisplay: describePlaybackState(store, nextPlaybackState),
      segmentEdit: this.state.segmentEdit?.segmentId === segmentId ? null : this.state.segmentEdit,
    });

    const persisted = await this.persistOrRollback(previousState, 'capture', async () => {
      await saveStore(store);
      if (mode === 'move' && playbackState?.sequenceId === source.id) {
        if (nextPlaybackState) {
          await savePlaybackState(nextPlaybackState);
        }
      }
    });
    if (!persisted) {
      return;
    }
    if (mode === 'move' && playbackState?.sequenceId === source.id && !nextPlaybackState) {
      const response = await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
      if (!response.ok) {
        await clearPlaybackState();
      }
    }
    await this.refreshPlayback();
  }

  beginQueueEdit(sequenceId: string): void {
    const sequence = this.state.store?.sequences.find((item) => item.id === sequenceId);
    if (!sequence) {
      return;
    }
    const segmentIds = playbackQueueIds(sequence, this.state.playbackState);

    this.setState({
      queueEdit: {
        sequenceId,
        segmentIds,
        baseSegmentIds: sequence.segments.map((segment) => segment.id),
      },
    });
  }

  cancelQueueEdit(): void {
    this.setState({ queueEdit: null });
  }

  moveQueueEditSegment(fromIndex: number, toIndex: number): void {
    const queueEdit = this.state.queueEdit;
    if (!queueEdit) {
      return;
    }

    this.setState({
      queueEdit: {
        ...queueEdit,
        segmentIds: moveItem(queueEdit.segmentIds, fromIndex, toIndex),
      },
    });
  }

  removeQueueEditSegment(segmentId: string): void {
    const queueEdit = this.state.queueEdit;
    if (!queueEdit || !queueEdit.segmentIds.includes(segmentId)) {
      return;
    }

    const currentSegmentId = this.state.playbackState?.sequenceId === queueEdit.sequenceId
      ? this.state.playbackState.currentSegmentId
      : undefined;
    if (segmentId === currentSegmentId) {
      return;
    }

    this.setState({
      queueEdit: {
        ...queueEdit,
        segmentIds: queueEdit.segmentIds.filter((item) => item !== segmentId),
      },
    });
  }

  async removePlaybackQueueSegment(segmentId: string): Promise<void> {
    const currentStore = this.state.store;
    const playbackState = this.state.playbackState;
    if (!currentStore || !playbackState || playbackState.currentSegmentId === segmentId) {
      return;
    }

    const sequence = currentStore.sequences.find((item) => item.id === playbackState.sequenceId);
    if (!sequence || !sequence.segments.some((segment) => segment.id === segmentId)) {
      return;
    }

    const nextSegmentIds = playbackQueueIds(sequence, playbackState).filter((item) => item !== segmentId);
    const nextPlaybackState = playbackStateAfterQueueEdit(playbackState, sequence, nextSegmentIds);
    if (!nextPlaybackState) {
      return;
    }
    const previousState = this.state;

    this.setState({
      playbackState: nextPlaybackState,
      playbackDisplay: describePlaybackState(currentStore, nextPlaybackState),
    });

    const persisted = await this.persistOrRollback(previousState, this.noticeTargetForRoute(previousState.route), async () => {
      await savePlaybackState(nextPlaybackState);
    });
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  async saveQueueEdit(): Promise<void> {
    const queueEdit = this.state.queueEdit;
    const currentStore = this.state.store;
    if (!queueEdit || !currentStore) {
      return;
    }
    const previousState = this.state;

    const sequence = currentStore.sequences.find((item) => item.id === queueEdit.sequenceId);
    if (!sequence) {
      this.setState({ queueEdit: null });
      return;
    }

    const playbackState = this.state.playbackState;
    if (playbackState?.sequenceId !== sequence.id) {
      this.setState({ queueEdit: null });
      return;
    }

    const nextPlaybackState = playbackStateAfterQueueEdit(playbackState, sequence, queueEdit.segmentIds);
    if (!nextPlaybackState) {
      this.setState({ queueEdit: null });
      return;
    }

    this.setState({
      queueEdit: null,
      playbackState: nextPlaybackState,
      playbackDisplay: describePlaybackState(currentStore, nextPlaybackState),
    });

    const persisted = await this.persistOrRollback(previousState, this.noticeTargetForRoute(previousState.route), async () => {
      await savePlaybackState(nextPlaybackState);
    });
    if (!persisted) {
      return;
    }
    await this.refreshPlayback();
  }

  async refreshVideo(): Promise<ActiveVideoResult> {
    const result = await getActiveVideoState();
    if (!samePageInfo(this.state.pageInfo, result.info) || !sameVideoState(this.state.videoState, result.videoState)) {
      this.setState({
        pageInfo: result.info,
        videoState: result.videoState,
      });
    }
    if (result.error && this.state.route === 'capture') {
      this.setCaptureError(createI18n(this.state.settings.language).capture.noticeVideoRefreshFailed(result.error));
    }
    return result;
  }

  async syncActiveVideoForCapture(): Promise<void> {
    if (this.state.route !== 'capture') {
      return;
    }

    const previousVideoId = this.state.pageInfo?.videoId ?? null;
    await this.refreshVideo();
    const nextVideoId = this.state.pageInfo?.videoId ?? null;

    if (previousVideoId !== nextVideoId) {
      await this.restoreDraft();
    }
  }

  async refreshPlayback(): Promise<void> {
    const playbackState = await loadPlaybackState();
    const playbackDisplay = this.state.store ? describePlaybackState(this.state.store, playbackState) : null;
    this.setState({ playbackState, playbackDisplay });
  }

  async syncPlaybackProgress(): Promise<void> {
    const playbackState = this.state.playbackState;
    if (
      this.state.route !== 'playback'
      || !playbackState?.tabId
      || (playbackState.status !== 'playing' && playbackState.status !== 'waiting' && playbackState.status !== 'pending' && playbackState.status !== 'paused')
    ) {
      return;
    }

    const pageInfo = await getPlaybackPageInfo(playbackState.tabId);
    if (!pageInfo?.videoId || pageInfo.currentTime === null || pageInfo.currentTime === undefined) {
      this.setPlaybackError(
        createI18n(this.state.settings.language).playback.connectionLost,
        this.recoveryFromPlaybackState(playbackState)
      );
      return;
    }

    const sequence = this.state.store?.sequences.find((item) => item.id === playbackState.sequenceId) ?? null;
    const segment = sequence?.segments.find((item) => item.id === playbackState.currentSegmentId)
      ?? sequence?.segments[playbackState.segmentIndex]
      ?? null;
    if (!segment || segment.videoId !== pageInfo.videoId) {
      if (!samePageInfo(this.state.pageInfo, pageInfo)) {
        this.setState({ pageInfo });
      }
      this.setPlaybackError(
        createI18n(this.state.settings.language).playback.connectionLost,
        this.recoveryFromPlaybackState(playbackState)
      );
      return;
    }

    const patch: Partial<AppState> = {};
    if (!samePageInfo(this.state.pageInfo, pageInfo)) {
      patch.pageInfo = pageInfo;
    }
    if (this.state.playbackNotice) {
      patch.playbackNotice = null;
    }
    if (Object.keys(patch).length > 0) {
      this.setState(patch);
    }
  }

  async refreshStore(): Promise<void> {
    const store = await loadStore();
    this.setState({ store });
    await this.refreshPlayback();
  }

  async restoreDraft(): Promise<void> {
    const videoId = this.state.pageInfo?.videoId ?? undefined;
    if (!videoId) {
      this.setState({ draftIn: null, draftOut: null });
      return;
    }

    const draft = await loadSegmentDraft(videoId);
    this.setState({ draftIn: draft?.startSeconds ?? null, draftOut: draft?.endSeconds ?? null });
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    const previousState = this.state;
    const settings = normalizeSettings({ ...this.state.settings, ...patch });
    this.setState({ settings });
    await this.persistOrRollback(previousState, 'settings', () => saveSettings(settings));
  }

  async setAccentKey(accentKey: Settings['accentKey']): Promise<void> {
    await this.updateSettings({ accentKey });
  }

  async setDefaultMixtape(sequenceId: string): Promise<void> {
    if (!this.state.store?.sequences.some((sequence) => sequence.id === sequenceId)) {
      return;
    }

    await this.updateSettings({ defaultMixtapeId: sequenceId });
  }

  async exportData(format: ExportFormat, options: ExportDataOptions = {}): Promise<void> {
    if (!this.state.store) {
      return;
    }

    const extension = format === 'json' ? 'json' : 'csv';
    const mimeType = format === 'json' ? 'application/json' : 'text/csv';
    const text = format === 'json' ? serializeStoreJson(this.state.store) : serializeStoreCsv(this.state.store);
    this.downloadTextFile(createExportFilename(this.state.store, extension, new Date(), options), mimeType, text);
    this.setSettingsInfo(createI18n(this.state.settings.language).settings.exportReady(format));
  }

  async importDataFile(file: Pick<File, 'text'>): Promise<void> {
    const i18n = createI18n(this.state.settings.language).settings;
    const store = parseImportedStoreJson(await file.text());
    if (!store) {
      this.setSettingsError(i18n.importFailed);
      return;
    }

    const previousState = this.state;
    const previousSettings = this.state.settings;
    const settings = store.sequences.some((sequence) => sequence.id === previousSettings.defaultMixtapeId)
      ? this.state.settings
      : normalizeSettings({ ...this.state.settings, defaultMixtapeId: undefined });
    const settingsChanged = settings !== previousSettings;
    this.setState({
      store,
      settings,
      playbackState: null,
      playbackDisplay: null,
      draftIn: null,
      draftOut: null,
      capturePulseId: null,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      settingsNotice: { kind: 'info', message: i18n.importReady(store.sequences.length) },
    });
    await this.persistOrRollback(previousState, 'settings', async () => {
      await saveStore(store);
      if (settingsChanged) {
        await saveSettings(settings);
      }
      await clearPlaybackState();
      await clearSegmentDraft();
    });
  }

  async deleteAllData(): Promise<void> {
    const previousState = this.state;
    const emptyStore: SnackTapeStore = {
      sequences: [],
      selectedSequenceId: null,
    };
    const settings = normalizeSettings({ ...this.state.settings, defaultMixtapeId: undefined });
    this.setState({
      store: emptyStore,
      settings,
      playbackState: null,
      playbackDisplay: null,
      draftIn: null,
      draftOut: null,
      capturePulseId: null,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      settingsNotice: { kind: 'info', message: createI18n(settings.language).settings.deleteAllDone },
    });
    await this.persistOrRollback(previousState, 'settings', async () => {
      await saveStore(emptyStore);
      await saveSettings(settings);
      await clearPlaybackState();
      await clearSegmentDraft();
    });
  }

  private downloadTextFile(filename: string, mimeType: string, text: string): void {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private setSettingsInfo(message: string): void {
    this.setState({ settingsNotice: { kind: 'info', message } });
  }

  private setSettingsError(message: string): void {
    this.setState({ settingsNotice: { kind: 'error', message } });
  }

  async captureIn(): Promise<void> {
    const cachedInfo = captureReadyPageInfo(this.state.pageInfo);
    if (cachedInfo) {
      await this.saveDraftIn(cachedInfo);
    }

    await this.refreshVideo();
    const pageInfo = captureReadyPageInfo(this.state.pageInfo);
    if (!pageInfo) {
      if (!cachedInfo) {
        this.setCaptureError(createI18n(this.state.settings.language).capture.noticeOpenYoutubeVideo);
      }
      return;
    }

    await this.saveDraftIn(pageInfo);
  }

  private async saveDraftIn(pageInfo: CaptureReadyPageInfo): Promise<void> {
    const previousState = this.state;
    const inSec = preciseTime(pageInfo.currentTime);
    this.setState({ draftIn: inSec, draftOut: null, captureNotice: null });
    await this.persistOrRollback(previousState, 'capture', () => saveSegmentDraft({
      videoId: pageInfo.videoId,
      startSeconds: inSec,
      endSeconds: null,
      updatedAt: Date.now(),
    }));
  }

  async captureOutPreview(): Promise<void> {
    const inSec = this.state.draftIn;
    const i18n = createI18n(this.state.settings.language).capture;
    if (inSec === null) {
      this.setCaptureError(i18n.noticeInFirst);
      return;
    }

    const cachedInfo = captureReadyPageInfo(this.state.pageInfo);
    await this.refreshVideo();
    const pageInfo = captureReadyPageInfo(this.state.pageInfo) ?? cachedInfo;
    if (!pageInfo) {
      this.setCaptureError(i18n.noticeTimeUnavailable);
      return;
    }

    const outSec = preciseTime(pageInfo.currentTime);
    const endSec = outSec <= inSec ? preciseTime(inSec + MIN_CAPTURE_DURATION_SECONDS) : outSec;
    const previousState = this.state;
    this.setState({ draftOut: endSec, captureNotice: null });
    await this.persistOrRollback(previousState, 'capture', () => saveSegmentDraft({
      videoId: pageInfo.videoId,
      startSeconds: inSec,
      endSeconds: endSec,
      updatedAt: Date.now(),
    }));
  }

  async clearDraft(): Promise<void> {
    const previousState = this.state;
    const videoId = this.state.pageInfo?.videoId ?? undefined;
    this.setState({ draftIn: null, draftOut: null, captureNotice: null });
    await this.persistOrRollback(previousState, 'capture', () => clearSegmentDraft(videoId));
  }

  async nudgeDraft(deltaSeconds: number, edge: SegmentEditEdge = 'start'): Promise<void> {
    const draftIn = this.state.draftIn;
    if (draftIn === null || !Number.isFinite(deltaSeconds)) {
      return;
    }

    if (!this.state.pageInfo?.videoId) {
      await this.refreshVideo();
    }

    const videoId = this.state.pageInfo?.videoId;
    if (!videoId) {
      return;
    }

    const previousState = this.state;
    const currentOut = this.state.draftOut;
    const isEnd = edge === 'end' && currentOut !== null;
    const nextIn = isEnd
      ? draftIn
      : preciseTime(Math.max(0, Math.min(draftIn + deltaSeconds, (currentOut ?? Number.POSITIVE_INFINITY) - MIN_CAPTURE_DURATION_SECONDS)));
    const nextOut = isEnd
      ? preciseTime(Math.max(draftIn + MIN_CAPTURE_DURATION_SECONDS, currentOut + deltaSeconds))
      : currentOut;

    this.setState({ draftIn: nextIn, draftOut: nextOut });
    await this.persistOrRollback(previousState, 'capture', () => saveSegmentDraft({
      videoId,
      startSeconds: nextIn,
      endSeconds: nextOut,
      updatedAt: Date.now(),
    }));
  }

  async captureOutAndSave(): Promise<void> {
    const sequence = this.selectedSequence();
    const inSec = this.state.draftIn;
    const i18n = createI18n(this.state.settings.language).capture;

    if (!sequence) {
      this.setCaptureError(i18n.noticeNoSaveTarget);
      return;
    }

    if (inSec === null) {
      this.setCaptureError(i18n.noticeInFirst);
      return;
    }

    const draftOut = this.state.draftOut;
    let pageInfo: CaptureReadyPageInfo | CaptureSaveMetadataPageInfo | null;
    let outSec: number;

    if (draftOut === null) {
      const cachedInfo = captureReadyPageInfo(this.state.pageInfo);
      await this.refreshVideo();
      const readyInfo = captureReadyPageInfo(this.state.pageInfo) ?? cachedInfo;
      if (!readyInfo) {
        this.setCaptureError(i18n.noticeTimeUnavailable);
        return;
      }
      pageInfo = readyInfo;
      outSec = preciseTime(readyInfo.currentTime);
    } else {
      const metadataInfo = captureSaveMetadataPageInfo(this.state.pageInfo);
      if (!metadataInfo) {
        this.setCaptureError(i18n.noticeTimeUnavailable);
        return;
      }
      pageInfo = metadataInfo;
      outSec = draftOut;
    }

    const endSec = outSec <= inSec ? preciseTime(inSec + MIN_CAPTURE_DURATION_SECONDS) : outSec;

    const timestamp = Date.now();
    const segment: Segment = {
      id: createId('clip'),
      videoId: pageInfo.videoId,
      originalUrl: pageInfo.url,
      title: this.captureTitle(pageInfo),
      startSeconds: inSec,
      endSeconds: endSec,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const errors = validateSegment(segment);
    if (errors.length > 0) {
      this.setCaptureError(i18n.noticeInvalidSegment);
      return;
    }

    const updatedSequence: Sequence = {
      ...sequence,
      segments: [...sequence.segments, segment],
      updatedAt: timestamp,
    };

    const currentStore = this.state.store;
    if (!currentStore) {
      return;
    }
    const previousState = this.state;

    const nextStore: SnackTapeStore = {
      ...currentStore,
      sequences: currentStore.sequences.map((item) => (item.id === updatedSequence.id ? updatedSequence : item)),
    };

    this.setState({ store: nextStore, draftIn: null, draftOut: null, capturePulseId: segment.id, captureNotice: null });
    const persisted = await this.persistOrRollback(previousState, 'capture', async () => {
      await saveStore(nextStore);
      await clearSegmentDraft(pageInfo.videoId);
    });
    if (!persisted) {
      return;
    }
    await this.refreshStore();
    window.setTimeout(() => {
      if (this.state.capturePulseId === segment.id) {
        this.setState({ capturePulseId: null });
      }
    }, 2000);
  }

  private captureTitle(pageInfo: { title: string; videoId: string }): string {
    if (!this.state.settings.autoTitleFromCaptions) {
      return `YouTube ${pageInfo.videoId}`;
    }

    const videoTitle = this.state.videoState?.videoId === pageInfo.videoId ? this.state.videoState.title.trim() : '';
    return videoTitle || pageInfo.title.trim() || `YouTube ${pageInfo.videoId}`;
  }

  private setCaptureError(message: string): void {
    this.setState({ captureNotice: { kind: 'error', message } });
  }

  async startSequence(startIndex = 0, sequenceId?: string, mode?: PlaybackMode, orderSegmentIds?: string[], queueEdited?: boolean): Promise<void> {
    const currentStore = this.state.store;
    const sequence = sequenceId && currentStore
      ? currentStore.sequences.find((item) => item.id === sequenceId) ?? null
      : this.selectedSequence();
    if (!sequence) {
      return;
    }

    const errors = validateSequence(sequence);
    if (errors.length > 0) {
      return;
    }

    const message: Extract<SnackTapeMessage, { type: 'START_SEQUENCE' }> = {
      type: 'START_SEQUENCE',
      sequenceId: sequence.id,
      startIndex,
      mode: mode ?? (this.state.settings.shuffleByDefault ? 'shuffle' : 'sequence'),
    };
    const pendingOrderSegmentIds = orderSegmentIds?.length ? existingUniqueSegmentIds(sequence, orderSegmentIds) : undefined;
    if (pendingOrderSegmentIds?.length) {
      message.orderSegmentIds = pendingOrderSegmentIds;
    }
    if (queueEdited) {
      message.queueEdited = true;
    }
    const pendingOrder = pendingOrderSegmentIds
      ? pendingOrderSegmentIds
          .map((segmentId) => sequence.segments.findIndex((segment) => segment.id === segmentId))
          .filter((index) => index >= 0)
      : undefined;
    const previousState = this.state;
    const previousPlaybackState = previousState.playbackState;
    const previousPlaybackDisplay = previousState.playbackDisplay;
    const pendingSegmentIndex = pendingOrder?.[0] ?? startIndex;
    const pendingPlaybackState: PlaybackState = {
      sequenceId: sequence.id,
      segmentIndex: pendingSegmentIndex,
      currentSegmentId: sequence.segments[pendingSegmentIndex]?.id,
      status: 'pending',
      startedAt: Date.now(),
      mode: message.mode,
    };
    if (pendingOrder) {
      pendingPlaybackState.order = pendingOrder;
      pendingPlaybackState.orderSegmentIds = pendingOrderSegmentIds;
      pendingPlaybackState.orderPosition = 0;
    }
    if (queueEdited) {
      pendingPlaybackState.queueEdited = true;
    }
    const recovery: PlaybackRecoveryAction = {
      type: 'start',
      sequenceId: sequence.id,
      startIndex: pendingSegmentIndex,
      mode: message.mode,
    };
    if (pendingOrderSegmentIds?.length) {
      recovery.orderSegmentIds = pendingOrderSegmentIds;
    }
    if (queueEdited) {
      recovery.queueEdited = true;
    }

    if (sequenceId && currentStore) {
      const nextStore = {
        ...currentStore,
        selectedSequenceId: sequenceId,
      };
      this.setState({
        route: 'playback',
        store: nextStore,
        playbackState: pendingPlaybackState,
        playbackDisplay: describePlaybackState(nextStore, pendingPlaybackState),
        playbackNotice: null,
        queueEdit: null,
        segmentEdit: null,
        renameEdit: null,
      });
      const persisted = await this.persistOrRollback(previousState, this.noticeTargetForRoute(previousState.route), () => saveStore(nextStore));
      if (!persisted) {
        return;
      }
    } else {
      this.setState({
        route: 'playback',
        playbackState: pendingPlaybackState,
        playbackDisplay: currentStore ? describePlaybackState(currentStore, pendingPlaybackState) : null,
        playbackNotice: null,
        queueEdit: null,
        segmentEdit: null,
        renameEdit: null,
      });
    }

    const response = await sendRuntimeMessage(message);
    if (!response.ok) {
      this.setState({
        route: 'playback',
        playbackState: previousPlaybackState,
        playbackDisplay: previousPlaybackDisplay,
        playbackNotice: {
          kind: 'error',
          message: this.playbackStartFailedMessage(response),
          recovery,
        },
      });
      return;
    }
    await this.refreshPlayback();
  }

  async startQueueFrom(sequenceId: string, segmentId: string, queueSegmentIds: string[]): Promise<void> {
    const sequence = this.state.store?.sequences.find((item) => item.id === sequenceId);
    if (!sequence) {
      return;
    }

    const queueIds = existingUniqueSegmentIds(sequence, queueSegmentIds);
    const startIndex = sequence.segments.findIndex((segment) => segment.id === segmentId);
    if (startIndex < 0 || queueIds[0] !== segmentId) {
      return;
    }

    await this.startSequence(startIndex, sequenceId, 'sequence', queueIds, true);
  }

  async stopPlayback(): Promise<void> {
    const previousPlaybackState = this.state.playbackState;
    const previousPlaybackDisplay = this.state.playbackDisplay;
    this.setState({ playbackNotice: null });
    const response = await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
    if (!response.ok) {
      this.setState({
        playbackState: previousPlaybackState,
        playbackDisplay: previousPlaybackDisplay,
      });
      this.setPlaybackError(this.playbackStopFailedMessage(response), { type: 'stop' });
      return;
    }
    this.setState({ playbackState: null, playbackDisplay: null, playbackNotice: null });
    await this.refreshPlayback();
  }

  async nextClip(): Promise<void> {
    const response = await sendRuntimeMessage({ type: 'PLAY_NEXT' });
    if (!response.ok) {
      this.setPlaybackError(this.playbackNextFailedMessage(response), { type: 'next' });
      return;
    }
    this.setState({ playbackNotice: null });
    await this.refreshPlayback();
  }

  async seekPlayback(seconds: number): Promise<void> {
    const response = await sendRuntimeMessage({ type: 'SEEK_PLAYBACK', sec: seconds });
    if (!response.ok) {
      this.setPlaybackError(this.playbackSeekFailedMessage(response), this.recoveryFromPlaybackState(this.state.playbackState));
      return;
    }

    this.setState({ playbackNotice: null });
    await this.refreshPlayback();
  }

  async pausePlayback(): Promise<void> {
    const response = await sendRuntimeMessage({ type: 'PAUSE_PLAYBACK' });
    if (!response.ok) {
      this.setPlaybackError(this.playbackPauseFailedMessage(response), this.recoveryFromPlaybackState(this.state.playbackState));
      return;
    }

    this.setState({ playbackNotice: null });
    await this.refreshPlayback();
  }

  async resumePlayback(): Promise<void> {
    const response = await sendRuntimeMessage({ type: 'RESUME_PLAYBACK' });
    if (!response.ok) {
      this.setPlaybackError(this.playbackResumeFailedMessage(response), this.recoveryFromPlaybackState(this.state.playbackState));
      return;
    }

    this.setState({ playbackNotice: null });
    await this.refreshPlayback();
  }

  async retryPlaybackRecovery(): Promise<void> {
    const recovery = this.state.playbackNotice?.recovery;
    if (!recovery) {
      return;
    }

    if (recovery.type === 'start') {
      await this.startSequence(recovery.startIndex, recovery.sequenceId, recovery.mode, recovery.orderSegmentIds, recovery.queueEdited);
      return;
    }

    if (recovery.type === 'next') {
      await this.nextClip();
      return;
    }

    await this.stopPlayback();
  }

  async handleCommand(name: Extract<SnackTapeMessage, { type: 'COMMAND_EVENT' }>['name']): Promise<void> {
    if (name === 'capture-in') {
      await this.captureIn();
    } else if (name === 'capture-out') {
      if (this.state.draftOut === null) {
        await this.captureOutPreview();
      } else {
        await this.captureOutAndSave();
      }
    } else if (name === 'next-clip') {
      await this.nextClip();
    } else if (name === 'play-pause') {
      if (this.state.playbackState?.status === 'paused') {
        await this.resumePlayback();
      } else if (this.state.playbackDisplay?.canStop) {
        await this.pausePlayback();
      } else {
        await this.startSequence(0);
      }
    }
  }

  async handleRuntimeMessage(message: SnackTapeMessage): Promise<void> {
    if (message.type === 'PLAYBACK_STATE_CHANGED') {
      await this.refreshPlayback();
    }
  }
}
