import { describePlaybackState, playbackStateAfterSequenceEdit, type PlaybackDisplayState } from '../shared/playback.js';
import { applySegmentOrder, moveItem, removeSegmentFromSequence } from '../shared/reorder.js';
import { parseImportedStoreJson, serializeStoreCsv, serializeStoreJson, type ExportFormat } from '../shared/dataTransfer.js';
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
import type { PageInfo, PlaybackMode, PlaybackState, Segment, Sequence, SnackTapeMessage, SnackTapeStore, VideoState } from '../shared/types.js';
import { validateSegment, validateSequence } from '../shared/validation.js';
import { createI18n } from '../i18n.js';
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings, type Settings } from './storage.js';
import { getActiveVideoState, sendRuntimeMessage, type ActiveVideoResult } from './youtube.js';

export type AppRoute = 'home' | 'capture' | 'playback' | 'settings' | 'detail';

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

export type AppState = {
  route: AppRoute;
  store: SnackTapeStore | null;
  settings: Settings;
  pageInfo: PageInfo | null;
  videoState: VideoState | null;
  playbackState: PlaybackState | null;
  playbackDisplay: PlaybackDisplayState | null;
  draftIn: number | null;
  capturePulseId: string | null;
  queueEdit: QueueEditState | null;
  segmentEdit: SegmentEditState | null;
  renameEdit: RenameEditState | null;
  captureNotice: CaptureNotice | null;
  settingsNotice: SettingsNotice | null;
  loading: boolean;
};

export type AppListener = (state: AppState) => void;

function selectedSequenceFrom(store: SnackTapeStore | null): Sequence | null {
  if (!store) {
    return null;
  }

  return store.sequences.find((sequence) => sequence.id === store.selectedSequenceId) ?? store.sequences[0] ?? null;
}

function roundedTime(value: number): number {
  return Math.round(value * 100) / 100;
}

type CaptureReadyPageInfo = PageInfo & {
  videoId: string;
  currentTime: number;
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
      draftIn: null,
      capturePulseId: null,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      captureNotice: null,
      settingsNotice: null,
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

  async createMixtape(): Promise<void> {
    const currentStore = this.state.store;
    if (!currentStore) {
      return;
    }

    const timestamp = Date.now();
    const sequence: Sequence = {
      id: createId('sequence'),
      name: `${createI18n(this.state.settings.language).common.unnamedMixtape} ${currentStore.sequences.length + 1}`,
      segments: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const store: SnackTapeStore = {
      sequences: [...currentStore.sequences, sequence],
      selectedSequenceId: sequence.id,
    };
    this.setState({ store });
    await saveStore(store);
    await this.refreshPlayback();
  }

  async openMixtape(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence) {
      return;
    }

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
    if (clearsPlayback) {
      await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
      await clearPlaybackState();
    }
    await saveStore(store);
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
    await saveStore(store);
    await this.refreshPlayback();
  }

  async beginRenameMixtape(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence) {
      return;
    }

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
    await saveStore(store);
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
    await saveStore(store);
    await this.refreshPlayback();
  }

  async deleteMixtape(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = currentStore?.sequences.find((item) => item.id === sequenceId);
    if (!currentStore || !sequence) {
      return;
    }

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

    if (clearsPlayback) {
      await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
      await clearPlaybackState();
    }

    await saveStore(store);
    if (clearsDefaultMixtape) {
      await saveSettings(settings);
    }
    await this.refreshPlayback();
  }

  async selectCaptureTarget(sequenceId: string): Promise<void> {
    const currentStore = this.state.store;
    if (!currentStore?.sequences.some((sequence) => sequence.id === sequenceId)) {
      return;
    }

    const store: SnackTapeStore = {
      ...currentStore,
      selectedSequenceId: sequenceId,
    };
    this.setState({ store, segmentEdit: null, renameEdit: null });
    await saveStore(store);
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

    const timestamp = Date.now();
    let changed = false;
    const segments = sequence.segments.map((segment) => {
      if (segment.id !== segmentId) {
        return segment;
      }

      if (edge === 'start') {
        const maxStart = segment.endSeconds === null ? Number.POSITIVE_INFINITY : Math.max(0, segment.endSeconds - 0.01);
        const startSeconds = roundedTime(Math.min(maxStart, Math.max(0, segment.startSeconds + deltaSeconds)));
        changed = startSeconds !== segment.startSeconds;
        return { ...segment, startSeconds, updatedAt: timestamp };
      }

      if (segment.endSeconds === null) {
        return segment;
      }

      const endSeconds = roundedTime(Math.max(segment.startSeconds + 0.01, segment.endSeconds + deltaSeconds));
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
    await saveStore(store);
    await this.refreshPlayback();
  }

  async deleteSegmentFromSelected(segmentId: string): Promise<void> {
    const currentStore = this.state.store;
    const sequence = this.selectedSequence();
    if (!currentStore || !sequence || !sequence.segments.some((segment) => segment.id === segmentId)) {
      return;
    }

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

    await saveStore(store);
    if (playbackState?.sequenceId === updatedSequence.id) {
      if (!nextPlaybackState) {
        await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
        await clearPlaybackState();
      } else {
        await savePlaybackState(nextPlaybackState);
      }
    }
    await this.refreshPlayback();
  }

  beginQueueEdit(sequenceId: string): void {
    const sequence = this.state.store?.sequences.find((item) => item.id === sequenceId);
    if (!sequence) {
      return;
    }

    this.setState({
      queueEdit: {
        sequenceId,
        segmentIds: sequence.segments.map((segment) => segment.id),
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

  async saveQueueEdit(): Promise<void> {
    const queueEdit = this.state.queueEdit;
    const currentStore = this.state.store;
    if (!queueEdit || !currentStore) {
      return;
    }

    const sequence = currentStore.sequences.find((item) => item.id === queueEdit.sequenceId);
    if (!sequence) {
      this.setState({ queueEdit: null });
      return;
    }

    const updatedSequence = applySegmentOrder(sequence, queueEdit.segmentIds, Date.now, queueEdit.baseSegmentIds);
    const store: SnackTapeStore = {
      ...currentStore,
      sequences: currentStore.sequences.map((item) => (item.id === updatedSequence.id ? updatedSequence : item)),
    };

    const playbackState = this.state.playbackState;
    const nextPlaybackState = playbackState?.sequenceId === updatedSequence.id && updatedSequence.segments.length > 0
      ? playbackStateAfterSequenceEdit(playbackState, updatedSequence)
      : playbackState ?? null;

    this.setState({
      store,
      queueEdit: null,
      playbackState: nextPlaybackState,
      playbackDisplay: describePlaybackState(store, nextPlaybackState),
    });

    await saveStore(store);
    if (playbackState?.sequenceId === updatedSequence.id && nextPlaybackState) {
      await savePlaybackState(nextPlaybackState);
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

  async refreshStore(): Promise<void> {
    const store = await loadStore();
    this.setState({ store });
    await this.refreshPlayback();
  }

  async restoreDraft(): Promise<void> {
    const videoId = this.state.pageInfo?.videoId;
    if (!videoId) {
      this.setState({ draftIn: null });
      return;
    }

    const draft = await loadSegmentDraft(videoId);
    this.setState({ draftIn: draft?.startSeconds ?? null });
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    const settings = normalizeSettings({ ...this.state.settings, ...patch });
    this.setState({ settings });
    await saveSettings(settings);
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

  async exportData(format: ExportFormat): Promise<void> {
    if (!this.state.store) {
      return;
    }

    const extension = format === 'json' ? 'json' : 'csv';
    const mimeType = format === 'json' ? 'application/json' : 'text/csv';
    const text = format === 'json' ? serializeStoreJson(this.state.store) : serializeStoreCsv(this.state.store);
    this.downloadTextFile(`snacktape-export-${Date.now()}.${extension}`, mimeType, text);
    this.setSettingsInfo(createI18n(this.state.settings.language).settings.exportReady(format));
  }

  async importDataFile(file: Pick<File, 'text'>): Promise<void> {
    const i18n = createI18n(this.state.settings.language).settings;
    const store = parseImportedStoreJson(await file.text());
    if (!store) {
      this.setSettingsError(i18n.importFailed);
      return;
    }

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
      capturePulseId: null,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      settingsNotice: { kind: 'info', message: i18n.importReady(store.sequences.length) },
    });
    await saveStore(store);
    if (settingsChanged) {
      await saveSettings(settings);
    }
    await clearPlaybackState();
    await clearSegmentDraft();
  }

  async deleteAllData(): Promise<void> {
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
      capturePulseId: null,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      settingsNotice: { kind: 'info', message: createI18n(settings.language).settings.deleteAllDone },
    });
    await saveStore(emptyStore);
    await saveSettings(settings);
    await clearPlaybackState();
    await clearSegmentDraft();
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
    const inSec = roundedTime(pageInfo.currentTime);
    this.setState({ draftIn: inSec, captureNotice: null });
    await saveSegmentDraft({
      videoId: pageInfo.videoId,
      startSeconds: inSec,
      endSeconds: null,
      updatedAt: Date.now(),
    });
  }

  async nudgeDraft(deltaSeconds: number): Promise<void> {
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

    const nextIn = roundedTime(Math.max(0, draftIn + deltaSeconds));
    this.setState({ draftIn: nextIn });
    await saveSegmentDraft({
      videoId,
      startSeconds: nextIn,
      endSeconds: null,
      updatedAt: Date.now(),
    });
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

    const cachedInfo = captureReadyPageInfo(this.state.pageInfo);
    await this.refreshVideo();
    const pageInfo = captureReadyPageInfo(this.state.pageInfo) ?? cachedInfo;
    if (!pageInfo) {
      this.setCaptureError(i18n.noticeTimeUnavailable);
      return;
    }

    const outSec = roundedTime(pageInfo.currentTime);
    const endSec = outSec <= inSec ? roundedTime(inSec + MIN_CAPTURE_DURATION_SECONDS) : outSec;

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

    const nextStore: SnackTapeStore = {
      ...currentStore,
      sequences: currentStore.sequences.map((item) => (item.id === updatedSequence.id ? updatedSequence : item)),
    };

    this.setState({ store: nextStore, draftIn: null, capturePulseId: segment.id, captureNotice: null });
    await saveStore(nextStore);
    await clearSegmentDraft(pageInfo.videoId);
    await this.refreshStore();
    window.setTimeout(() => {
      if (this.state.capturePulseId === segment.id) {
        this.setState({ capturePulseId: null });
      }
    }, 2000);
  }

  private captureTitle(pageInfo: CaptureReadyPageInfo): string {
    if (!this.state.settings.autoTitleFromCaptions) {
      return `YouTube ${pageInfo.videoId}`;
    }

    const videoTitle = this.state.videoState?.videoId === pageInfo.videoId ? this.state.videoState.title.trim() : '';
    return videoTitle || pageInfo.title.trim() || `YouTube ${pageInfo.videoId}`;
  }

  private setCaptureError(message: string): void {
    this.setState({ captureNotice: { kind: 'error', message } });
  }

  async startSequence(startIndex = 0, sequenceId?: string, mode?: PlaybackMode): Promise<void> {
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

    const message: SnackTapeMessage = {
      type: 'START_SEQUENCE',
      sequenceId: sequence.id,
      startIndex,
      mode: mode ?? (this.state.settings.shuffleByDefault ? 'shuffle' : 'sequence'),
    };
    const previousRoute = this.state.route;
    const previousPlaybackState = this.state.playbackState;
    const previousPlaybackDisplay = this.state.playbackDisplay;
    const pendingPlaybackState: PlaybackState = {
      sequenceId: sequence.id,
      segmentIndex: startIndex,
      currentSegmentId: sequence.segments[startIndex]?.id,
      status: 'pending',
      startedAt: Date.now(),
      mode: message.mode,
    };

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
        queueEdit: null,
        segmentEdit: null,
        renameEdit: null,
      });
      await saveStore(nextStore);
    } else {
      this.setState({
        route: 'playback',
        playbackState: pendingPlaybackState,
        playbackDisplay: currentStore ? describePlaybackState(currentStore, pendingPlaybackState) : null,
        queueEdit: null,
        segmentEdit: null,
        renameEdit: null,
      });
    }

    const response = await sendRuntimeMessage(message);
    if (!response.ok) {
      this.setState({
        route: previousRoute,
        playbackState: previousPlaybackState,
        playbackDisplay: previousPlaybackDisplay,
      });
      return;
    }
    await this.refreshPlayback();
  }

  async stopPlayback(): Promise<void> {
    this.setState({ playbackState: null, playbackDisplay: null });
    const response = await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
    if (!response.ok) {
      await clearPlaybackState();
      return;
    }
    await this.refreshPlayback();
  }

  async nextClip(): Promise<void> {
    const response = await sendRuntimeMessage({ type: 'PLAY_NEXT' });
    if (!response.ok) {
      return;
    }
    await this.refreshPlayback();
  }

  async handleCommand(name: Extract<SnackTapeMessage, { type: 'COMMAND_EVENT' }>['name']): Promise<void> {
    if (name === 'capture-in') {
      await this.captureIn();
    } else if (name === 'capture-out') {
      await this.captureOutAndSave();
    } else if (name === 'next-clip') {
      await this.nextClip();
    } else if (name === 'play-pause') {
      if (this.state.playbackDisplay?.canStop) {
        await this.stopPlayback();
      } else {
        await this.startSequence(0);
      }
    }
  }
}
