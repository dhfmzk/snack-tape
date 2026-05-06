import { describePlaybackState, playbackStateAfterSequenceEdit, type PlaybackDisplayState } from '../shared/playback.js';
import { applySegmentOrder, moveItem, removeSegmentFromSequence } from '../shared/reorder.js';
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
import { loadSettings, saveSettings, type Settings } from './storage.js';
import { getActiveVideoState, sendRuntimeMessage } from './youtube.js';

export type AppRoute = 'home' | 'capture' | 'playback' | 'settings' | 'detail';

export type QueueEditState = {
  sequenceId: string;
  segmentIds: string[];
};

export type SegmentEditEdge = 'start' | 'end';

export type SegmentEditState = {
  segmentId: string;
};

export type RenameEditState = {
  sequenceId: string;
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

const MIN_CAPTURE_DURATION_SECONDS = 1 / 30;

export class SnackTapeAppStore {
  private state: AppState;
  private listeners = new Set<AppListener>();

  constructor() {
    this.state = {
      route: 'home',
      store: null,
      settings: {
        accentKey: 'peach',
        autoNext: true,
        fadeOut: true,
        shuffleByDefault: false,
        shortcutIn: 'I',
        shortcutOut: 'O',
        autoTitleFromCaptions: true,
      },
      pageInfo: null,
      videoState: null,
      playbackState: null,
      playbackDisplay: null,
      draftIn: null,
      capturePulseId: null,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
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
      name: `믹스테이프 ${currentStore.sequences.length + 1}`,
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

    const store: SnackTapeStore = {
      ...currentStore,
      selectedSequenceId: sequenceId,
    };
    this.setState({
      route: sequence.segments.length === 0 ? 'capture' : 'playback',
      store,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
    });
    await saveStore(store);
    await this.refreshPlayback();
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

    this.setState({
      route: store.sequences.length === 0 ? 'home' : 'capture',
      store,
      playbackState: clearsPlayback ? null : this.state.playbackState,
      playbackDisplay: clearsPlayback ? describePlaybackState(store, null) : this.state.playbackDisplay,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      capturePulseId: null,
    });

    if (clearsPlayback) {
      await clearPlaybackState();
    }

    await saveStore(store);
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

    const updatedSequence = applySegmentOrder(sequence, queueEdit.segmentIds);
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

  async refreshVideo(): Promise<void> {
    const result = await getActiveVideoState();
    this.setState({
      pageInfo: result.info,
      videoState: result.videoState,
    });
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
    const settings = { ...this.state.settings, ...patch };
    this.setState({ settings });
    await saveSettings(settings);
  }

  async setAccentKey(accentKey: Settings['accentKey']): Promise<void> {
    await this.updateSettings({ accentKey });
  }

  async captureIn(): Promise<void> {
    await this.refreshVideo();
    const currentTime = this.state.pageInfo?.currentTime;
    const videoId = this.state.pageInfo?.videoId;

    if (!videoId || currentTime === null || currentTime === undefined) {
      return;
    }

    const inSec = roundedTime(currentTime);
    this.setState({ draftIn: inSec });
    await saveSegmentDraft({
      videoId,
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
    await this.refreshVideo();
    const sequence = this.selectedSequence();
    const pageInfo = this.state.pageInfo;
    const inSec = this.state.draftIn;
    const outSec = pageInfo?.currentTime === null || pageInfo?.currentTime === undefined ? null : roundedTime(pageInfo.currentTime);

    if (!sequence || !pageInfo?.videoId || !pageInfo.isYouTubeVideoPage) {
      return;
    }

    if (inSec === null) {
      return;
    }

    if (outSec === null) {
      return;
    }

    const endSec = outSec <= inSec ? roundedTime(inSec + MIN_CAPTURE_DURATION_SECONDS) : outSec;

    const timestamp = Date.now();
    const segment: Segment = {
      id: createId('clip'),
      videoId: pageInfo.videoId,
      originalUrl: pageInfo.url,
      title: pageInfo.title || `YouTube ${pageInfo.videoId}`,
      startSeconds: inSec,
      endSeconds: endSec,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const errors = validateSegment(segment);
    if (errors.length > 0) {
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

    this.setState({ store: nextStore, draftIn: null, capturePulseId: segment.id });
    await saveStore(nextStore);
    await clearSegmentDraft(pageInfo.videoId);
    await this.refreshStore();
    window.setTimeout(() => {
      if (this.state.capturePulseId === segment.id) {
        this.setState({ capturePulseId: null });
      }
    }, 2000);
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

    if (sequenceId && currentStore) {
      const nextStore = {
        ...currentStore,
        selectedSequenceId: sequenceId,
      };
      this.setState({
        route: 'playback',
        store: nextStore,
        queueEdit: null,
        segmentEdit: null,
        renameEdit: null,
      });
      await saveStore(nextStore);
      await this.refreshStore();
    } else {
      this.setState({
        route: 'playback',
        queueEdit: null,
        segmentEdit: null,
        renameEdit: null,
      });
    }

    await sendRuntimeMessage(message);
    await this.refreshPlayback();
  }

  async stopPlayback(): Promise<void> {
    await sendRuntimeMessage({ type: 'STOP_SEQUENCE' });
    await this.refreshPlayback();
  }

  async nextClip(): Promise<void> {
    await sendRuntimeMessage({ type: 'PLAY_NEXT' });
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
