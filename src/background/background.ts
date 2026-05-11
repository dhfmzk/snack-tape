import { createPlaybackOrder, getNextPlaybackStep } from '../shared/playback.js';
import { findYouTubePlaybackTab, isExtensionPageUrl } from '../shared/playbackTarget.js';
import { failureResponse, SnackTapeError } from '../shared/errors.js';
import {
  clearSegmentDraft,
  clearPlaybackState,
  createId,
  loadSegmentDraft,
  loadPlaybackState,
  loadStore,
  savePlaybackState,
  saveSegmentDraft,
  saveStore
} from '../shared/storage.js';
import { createI18n } from '../i18n.js';
import type { PageInfo, PlaybackMode, PlaybackStartResult, PlaybackState, Segment, Sequence, SnackTapeMessage, SnackTapeResponse, VideoState } from '../shared/types.js';
import { validateSegment, validateSequence } from '../shared/validation.js';
import { parseYouTubeVideoId } from '../shared/youtube.js';
import { loadSettings } from '../state/storage.js';

const MAX_MESSAGE_RETRIES = 12;
const MESSAGE_RETRY_DELAY_MS = 350;
const COMMAND_NAMES = ['capture-in', 'capture-out', 'play-pause', 'next-clip'] as const;
type CommandName = (typeof COMMAND_NAMES)[number];
const MIN_CAPTURE_DURATION_SECONDS = 1 / 30;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPlaybackToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isCommandName(command: string): command is CommandName {
  return COMMAND_NAMES.includes(command as CommandName);
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab?.id) {
    throw new Error('활성 탭을 찾을 수 없습니다.');
  }

  return tab;
}

async function getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

function getSequence(storeSequences: Sequence[], sequenceId: string): Sequence {
  const sequence = storeSequences.find((item) => item.id === sequenceId);
  if (!sequence) {
    throw new Error('시퀀스를 찾을 수 없습니다.');
  }

  return sequence;
}

function findSequence(storeSequences: Sequence[], sequenceId: string): Sequence | null {
  return storeSequences.find((item) => item.id === sequenceId) ?? null;
}

type PlaybackRequest = {
  mode: PlaybackMode;
  order: number[];
  orderSegmentIds: string[];
  orderPosition: number;
  queueEdited?: boolean;
};

const FADE_OUT_SECONDS = 0.3;

function normalizePlaybackMode(mode: PlaybackMode | undefined): PlaybackMode {
  return mode === 'shuffle' || mode === 'repeat' ? mode : 'sequence';
}

class ContentResponseError extends SnackTapeError {}

async function playbackModeFromSettings(): Promise<PlaybackMode> {
  const settings = await loadSettings();
  return settings.shuffleByDefault ? 'shuffle' : 'sequence';
}

function canonicalWatchUrl(segment: Segment): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(segment.videoId)}&t=${Math.floor(segment.startSeconds)}s`;
}

function fallbackVideoTitle(tab: chrome.tabs.Tab, videoId: string): string {
  return tab.title?.replace(/\s+-\s+YouTube$/, '').trim() || `YouTube ${videoId}`;
}

function selectCaptureSequence(sequences: Sequence[], selectedSequenceId: string | null, defaultMixtapeId?: string): Sequence | null {
  if (defaultMixtapeId) {
    const defaultSequence = sequences.find((sequence) => sequence.id === defaultMixtapeId);
    if (defaultSequence) {
      return defaultSequence;
    }
  }

  return sequences.find((sequence) => sequence.id === selectedSequenceId) ?? sequences[0] ?? null;
}

function orderSegmentIds(sequence: Sequence, order: number[]): string[] {
  return order.map((index) => sequence.segments[index]?.id).filter((id): id is string => Boolean(id));
}

function existingUniqueSegmentIds(sequence: Sequence, segmentIds: string[]): string[] {
  const existingIds = new Set(sequence.segments.map((segment) => segment.id));
  const used = new Set<string>();
  const nextIds: string[] = [];

  for (const segmentId of segmentIds) {
    if (!existingIds.has(segmentId) || used.has(segmentId)) {
      continue;
    }
    used.add(segmentId);
    nextIds.push(segmentId);
  }

  return nextIds;
}

function segmentOrder(sequence: Sequence, segmentIds: string[]): number[] {
  return segmentIds
    .map((segmentId) => sequence.segments.findIndex((segment) => segment.id === segmentId))
    .filter((index) => index >= 0);
}

function currentPlaybackSegment(sequence: Sequence, state: PlaybackState): Segment | null {
  return (state.currentSegmentId ? sequence.segments.find((item) => item.id === state.currentSegmentId) : null)
    ?? sequence.segments[state.segmentIndex]
    ?? null;
}

function clampToSegment(seconds: number, segment: Segment): number {
  const lower = Math.max(0, segment.startSeconds);
  const upper = segment.endSeconds !== null && segment.endSeconds >= lower ? segment.endSeconds : Number.POSITIVE_INFINITY;
  const safeSeconds = Number.isFinite(seconds) ? seconds : lower;
  return Math.max(lower, Math.min(upper, safeSeconds));
}

function startedAtForSegmentTime(segment: Segment, absoluteSeconds: number): number {
  const elapsed = Math.max(0, absoluteSeconds - segment.startSeconds);
  return Date.now() - Math.round(elapsed * 1000);
}

async function playbackI18n() {
  const settings = await loadSettings();
  return createI18n(settings.language);
}

async function playbackContext(): Promise<{ state: PlaybackState & { tabId: number }; sequence: Sequence; segment: Segment }> {
  const state = await loadPlaybackState();
  if (!state?.tabId) {
    throw new Error((await playbackI18n()).playback.noPlaybackTab);
  }

  const store = await loadStore();
  const sequence = getSequence(store.sequences, state.sequenceId);
  const segment = currentPlaybackSegment(sequence, state);
  if (!segment) {
    throw new Error((await playbackI18n()).playback.currentSegmentMissing);
  }

  return { state: state as PlaybackState & { tabId: number }, sequence, segment };
}

async function assertPlaybackTabMatches(state: PlaybackState & { tabId: number }, segment: Segment): Promise<PageInfo> {
  const response = await sendMessageWithRetries<PageInfo>(state.tabId, { type: 'GET_PAGE_INFO' });
  const pageInfo = response.data;
  if (!pageInfo?.isYouTubeVideoPage || pageInfo.videoId !== segment.videoId) {
    throw new Error((await playbackI18n()).playback.connectionLost);
  }

  return pageInfo;
}

async function readCurrentPlaybackTime(state: PlaybackState & { tabId: number }, segment: Segment, pageInfo?: PageInfo): Promise<number> {
  if (typeof pageInfo?.currentTime === 'number' && Number.isFinite(pageInfo.currentTime)) {
    return clampToSegment(pageInfo.currentTime, segment);
  }

  {
    const response = await sendMessageWithRetries<number | null>(state.tabId, { type: 'GET_CURRENT_TIME' });
    if (typeof response.data === 'number' && Number.isFinite(response.data)) {
      return clampToSegment(response.data, segment);
    }
  }

  if (typeof state.currentTime === 'number' && Number.isFinite(state.currentTime)) {
    return clampToSegment(state.currentTime, segment);
  }

  if (Number.isFinite(state.startedAt)) {
    return clampToSegment(segment.startSeconds + ((Date.now() - state.startedAt) / 1000), segment);
  }

  return clampToSegment(segment.startSeconds, segment);
}

function notifyPlaybackStateChanged(): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'PLAYBACK_STATE_CHANGED' }, () => {
      // Side panels may be closed; the playback state in storage remains the source of truth.
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

async function sendMessageToTab<T>(tabId: number, message: SnackTapeMessage): Promise<SnackTapeResponse<T>> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: SnackTapeResponse<T> | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response ?? { ok: true });
    });
  });
}

async function injectContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch {
    // The declarative content script usually handles injection. This is only a best-effort recovery path.
  }
}

async function createPlaybackTab(segment: Segment): Promise<number> {
  const tab = await chrome.tabs.create({
    active: true,
    url: canonicalWatchUrl(segment)
  });

  if (!tab.id) {
    throw new Error('재생할 탭을 만들 수 없습니다.');
  }

  return tab.id;
}

async function resolvePlaybackTabId(firstSegment: Segment, requestedTabId?: number): Promise<number> {
  if (requestedTabId) {
    const requestedTab = await getTab(requestedTabId);
    if (requestedTab?.id && requestedTab.url && parseYouTubeVideoId(requestedTab.url)) {
      return requestedTab.id;
    }
  }

  const activeTab = await getActiveTab();
  if (!isExtensionPageUrl(activeTab.url) && activeTab.url && parseYouTubeVideoId(activeTab.url)) {
    return activeTab.id!;
  }

  const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
  const youtubeTabId = findYouTubePlaybackTab(currentWindowTabs);
  if (youtubeTabId) {
    return youtubeTabId;
  }

  return createPlaybackTab(firstSegment);
}

function waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
  if (!chrome.tabs.onUpdated?.addListener || !chrome.tabs.onUpdated?.removeListener) {
    return delay(0);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        finish();
      }
    };
    const timeout = setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendMessageWithRetries<T>(tabId: number, message: SnackTapeMessage): Promise<SnackTapeResponse<T>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_MESSAGE_RETRIES; attempt += 1) {
    try {
      const response = await sendMessageToTab<T>(tabId, message);
      if (!response.ok) {
        const errorCode = response.errorCode ?? 'unknown';
        let message = response.error;
        if (message === undefined) {
          const i18n = await playbackI18n();
          message = errorCode === 'content_request_failed' ? i18n.playback.contentRequestFailed : i18n.playback.unknownError;
        }
        throw new ContentResponseError(errorCode, message);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError instanceof ContentResponseError) {
        throw lastError;
      }
      if (attempt === 1) {
        await injectContentScript(tabId);
      }
      await delay(MESSAGE_RETRY_DELAY_MS);
    }
  }

  void lastError;
  throw new SnackTapeError('content_request_failed', (await playbackI18n()).playback.contentRequestFailed);
}

async function readActiveVideoForCapture(): Promise<{ tab: chrome.tabs.Tab; videoState: VideoState }> {
  const tab = await getActiveTab();
  if (!tab.id || !tab.url || !parseYouTubeVideoId(tab.url)) {
    throw new Error('YouTube 영상을 열어주세요.');
  }

  const response = await sendMessageWithRetries<VideoState>(tab.id, { type: 'getVideoState' });
  const videoState = response.data;
  if (!videoState?.videoId || !Number.isFinite(videoState.currentTime)) {
    throw new Error('영상 시간을 읽을 수 없습니다.');
  }

  return { tab, videoState };
}

export async function captureInFromCommand(): Promise<void> {
  const { videoState } = await readActiveVideoForCapture();
  await saveSegmentDraft({
    videoId: videoState.videoId!,
    startSeconds: videoState.currentTime,
    endSeconds: null,
    updatedAt: Date.now(),
  });
}

export async function captureOutFromCommand(): Promise<void> {
  const { tab, videoState } = await readActiveVideoForCapture();
  const draft = await loadSegmentDraft(videoState.videoId!);
  if (!draft || draft.startSeconds === null) {
    throw new Error('IN 먼저 찍어주세요.');
  }

  const [store, settings] = await Promise.all([loadStore(), loadSettings()]);
  const sequence = selectCaptureSequence(store.sequences, store.selectedSequenceId, settings.defaultMixtapeId);
  if (!sequence) {
    throw new Error('저장할 믹스테이프를 선택하세요.');
  }

  const timestamp = Date.now();
  const outSeconds = draft.endSeconds ?? videoState.currentTime;
  const endSeconds = outSeconds <= draft.startSeconds ? draft.startSeconds + MIN_CAPTURE_DURATION_SECONDS : outSeconds;
  const title = settings.autoTitleFromCaptions
    ? videoState.title.trim() || fallbackVideoTitle(tab, videoState.videoId!)
    : `YouTube ${videoState.videoId}`;
  const segment: Segment = {
    id: createId('clip'),
    videoId: videoState.videoId!,
    originalUrl: tab.url ?? `https://www.youtube.com/watch?v=${encodeURIComponent(videoState.videoId!)}`,
    title,
    startSeconds: draft.startSeconds,
    endSeconds,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const errors = validateSegment(segment);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  const updatedSequence: Sequence = {
    ...sequence,
    segments: [...sequence.segments, segment],
    updatedAt: timestamp,
  };
  await saveStore({
    ...store,
    selectedSequenceId: sequence.id,
    sequences: store.sequences.map((item) => (item.id === sequence.id ? updatedSequence : item)),
  });
  await clearSegmentDraft(videoState.videoId!);
}

export async function startSequence(
  sequenceId: string,
  startIndex = 0,
  mode?: PlaybackMode,
  requestedTabId?: number,
  requestedOrderSegmentIds?: string[],
  queueEdited?: boolean
): Promise<void> {
  const store = await loadStore();
  const sequence = getSequence(store.sequences, sequenceId);
  const errors = validateSequence(sequence);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  const playbackMode = mode ? normalizePlaybackMode(mode) : await playbackModeFromSettings();
  const explicitOrderSegmentIds = requestedOrderSegmentIds?.length
    ? existingUniqueSegmentIds(sequence, requestedOrderSegmentIds)
    : [];
  const order = explicitOrderSegmentIds.length > 0
    ? segmentOrder(sequence, explicitOrderSegmentIds)
    : createPlaybackOrder(sequence.segments.length, startIndex, playbackMode);
  if (order.length === 0) {
    throw new Error('재생할 구간을 찾을 수 없습니다.');
  }

  const firstSegmentIndex = order[0];
  const firstSegment = sequence.segments[firstSegmentIndex];
  if (!firstSegment) {
    throw new Error('재생할 구간을 찾을 수 없습니다.');
  }

  const tabId = await resolvePlaybackTabId(firstSegment, requestedTabId);
  await playSegment(sequenceId, firstSegmentIndex, tabId, {
    mode: playbackMode,
    order,
    orderSegmentIds: explicitOrderSegmentIds.length > 0 ? explicitOrderSegmentIds : orderSegmentIds(sequence, order),
    orderPosition: 0,
    queueEdited
  });
}

export async function playSegment(
  sequenceId: string,
  segmentIndex: number,
  requestedTabId?: number,
  playbackRequest?: PlaybackRequest
): Promise<void> {
  const store = await loadStore();
  const sequence = getSequence(store.sequences, sequenceId);
  const segment = sequence.segments[segmentIndex];

  if (!segment) {
    throw new Error('재생할 구간을 찾을 수 없습니다.');
  }

  const previousState = await loadPlaybackState();
  let tabId = requestedTabId ?? previousState?.tabId;
  if (!tabId) {
    const activeTab = await getActiveTab();
    tabId = activeTab.id;
  }

  if (!tabId) {
    throw new Error('재생할 탭을 찾을 수 없습니다.');
  }

  const tab = await getTab(tabId);
  const playbackToken = createPlaybackToken();

  const playbackState: PlaybackState = {
    sequenceId,
    segmentIndex,
    currentSegmentId: segment.id,
    tabId,
    status: 'pending',
    startedAt: Date.now(),
    playbackToken,
    mode: playbackRequest?.mode ?? previousState?.mode ?? 'sequence',
    order: playbackRequest?.order ?? previousState?.order ?? createPlaybackOrder(sequence.segments.length, segmentIndex),
    orderSegmentIds: playbackRequest?.orderSegmentIds
      ?? previousState?.orderSegmentIds
      ?? orderSegmentIds(sequence, createPlaybackOrder(sequence.segments.length, segmentIndex)),
    orderPosition: playbackRequest?.orderPosition ?? previousState?.orderPosition ?? segmentIndex,
    queueEdited: playbackRequest ? playbackRequest.queueEdited : previousState?.queueEdited
  };

  const activeVideoId = tab?.url ? parseYouTubeVideoId(tab.url) : null;
  if (activeVideoId !== segment.videoId) {
    const tabReady = waitForTabComplete(tabId);
    await chrome.tabs.update(tabId, { url: canonicalWatchUrl(segment) });
    await tabReady;
  }

  try {
    const settings = await loadSettings();
    const response = await sendMessageWithRetries<PlaybackStartResult>(tabId, {
      type: 'PLAY_SEGMENT',
      segment,
      playbackToken,
      fadeOut: settings.fadeOut,
      fadeOutSeconds: FADE_OUT_SECONDS,
      language: settings.language,
      accentKey: settings.accentKey
    });
    const startedTime = typeof response.data?.currentTime === 'number' && Number.isFinite(response.data.currentTime)
      ? response.data.currentTime
      : segment.startSeconds;
    const elapsedFromSegmentStart = Math.max(0, startedTime - segment.startSeconds);
    await savePlaybackState({
      ...playbackState,
      status: response.data?.status === 'waiting' ? 'waiting' : 'playing',
      currentTime: startedTime,
      startedAt: Date.now() - Math.round(elapsedFromSegmentStart * 1000)
    });
  } catch (error) {
    const currentState = await loadPlaybackState();
    if (currentState?.playbackToken === playbackToken) {
      await clearPlaybackState();
    }
    throw error;
  }
}

export async function nextSegment(playbackToken?: string): Promise<void> {
  const state = await loadPlaybackState();
  if (!state || (state.status !== 'playing' && state.status !== 'waiting' && state.status !== 'paused')) {
    return;
  }

  if (playbackToken && state.playbackToken && playbackToken !== state.playbackToken) {
    return;
  }

  const store = await loadStore();
  const sequence = findSequence(store.sequences, state.sequenceId);
  if (!sequence) {
    await stopPlayback(playbackToken);
    return;
  }
  const settings = await loadSettings();
  if (!settings.autoNext) {
    await stopPlayback(playbackToken);
    return;
  }

  const nextStep = getNextPlaybackStep(sequence, state);

  if (!nextStep) {
    await stopPlayback(playbackToken);
    return;
  }

  const currentState = await loadPlaybackState();
  if (playbackToken && currentState?.playbackToken !== playbackToken) {
    return;
  }

  await playSegment(state.sequenceId, nextStep.segmentIndex, state.tabId, {
    mode: state.mode ?? 'sequence',
    order: state.order ?? createPlaybackOrder(sequence.segments.length, state.segmentIndex),
    orderSegmentIds: state.orderSegmentIds ?? orderSegmentIds(sequence, state.order ?? createPlaybackOrder(sequence.segments.length, state.segmentIndex)),
    orderPosition: nextStep.orderPosition,
    queueEdited: state.queueEdited
  });
  await notifyPlaybackStateChanged();
}

export async function markPlaybackStarted(playbackToken: string, currentTime?: number): Promise<void> {
  const state = await loadPlaybackState();
  if (!state || state.playbackToken !== playbackToken || state.status !== 'waiting') {
    return;
  }

  const store = await loadStore();
  const sequence = findSequence(store.sequences, state.sequenceId);
  const segment = sequence?.segments.find((item) => item.id === state.currentSegmentId)
    ?? sequence?.segments[state.segmentIndex]
    ?? null;
  const elapsedFromSegmentStart = segment && typeof currentTime === 'number' && Number.isFinite(currentTime)
    ? Math.max(0, currentTime - segment.startSeconds)
    : 0;

  await savePlaybackState({
    ...state,
    status: 'playing',
    currentTime,
    startedAt: Date.now() - Math.round(elapsedFromSegmentStart * 1000)
  });
  await notifyPlaybackStateChanged();
}

export async function seekPlayback(seconds: number): Promise<void> {
  const { state, segment } = await playbackContext();
  await assertPlaybackTabMatches(state, segment);
  const targetSeconds = clampToSegment(seconds, segment);

  await sendMessageWithRetries(state.tabId, { type: 'seek', sec: targetSeconds });
  await savePlaybackState({
    ...state,
    currentTime: targetSeconds,
    startedAt: startedAtForSegmentTime(segment, targetSeconds)
  });
  await notifyPlaybackStateChanged();
}

export async function pausePlayback(): Promise<void> {
  const { state, segment } = await playbackContext();
  if (state.status === 'paused') {
    return;
  }

  const pageInfo = await assertPlaybackTabMatches(state, segment);
  const currentTime = await readCurrentPlaybackTime(state, segment, pageInfo);
  await sendMessageWithRetries(state.tabId, { type: 'pause' });
  await savePlaybackState({
    ...state,
    status: 'paused',
    currentTime,
    startedAt: startedAtForSegmentTime(segment, currentTime)
  });
  await notifyPlaybackStateChanged();
}

export async function resumePlayback(): Promise<void> {
  const { state, segment } = await playbackContext();
  if (state.status === 'playing') {
    return;
  }

  const pageInfo = await assertPlaybackTabMatches(state, segment);
  const currentTime = await readCurrentPlaybackTime(state, segment, pageInfo);
  const settings = await loadSettings();
  const response = await sendMessageWithRetries<PlaybackStartResult>(state.tabId, {
    type: 'play',
    language: settings.language,
    accentKey: settings.accentKey
  });
  const resumedTime = typeof response.data?.currentTime === 'number' && Number.isFinite(response.data.currentTime)
    ? clampToSegment(response.data.currentTime, segment)
    : currentTime;
  await savePlaybackState({
    ...state,
    status: response.data?.status === 'waiting' ? 'waiting' : 'playing',
    currentTime: resumedTime,
    startedAt: startedAtForSegmentTime(segment, resumedTime)
  });
  await notifyPlaybackStateChanged();
}

export async function stopPlayback(expectedPlaybackToken?: string): Promise<void> {
  const state = await loadPlaybackState();
  if (expectedPlaybackToken && state?.playbackToken !== expectedPlaybackToken) {
    return;
  }

  if (state?.tabId) {
    try {
      await sendMessageToTab(state.tabId, { type: 'STOP_PLAYBACK' });
    } catch {
      // Stopping should clear local state even if the tab is gone or the content script is unreachable.
    }
  }

  await clearPlaybackState();
  await notifyPlaybackStateChanged();
}

async function handleMessage(message: SnackTapeMessage): Promise<SnackTapeResponse> {
  if (message.type === 'START_SEQUENCE') {
    await startSequence(
      message.sequenceId,
      message.startIndex ?? 0,
      message.mode ? normalizePlaybackMode(message.mode) : undefined,
      message.tabId,
      message.orderSegmentIds,
      message.queueEdited
    );
    return { ok: true };
  }

  if (message.type === 'PLAY_NEXT' || message.type === 'SEGMENT_ENDED') {
    await nextSegment(message.playbackToken);
    return { ok: true };
  }

  if (message.type === 'SEEK_PLAYBACK') {
    await seekPlayback(message.sec);
    return { ok: true };
  }

  if (message.type === 'PAUSE_PLAYBACK') {
    await pausePlayback();
    return { ok: true };
  }

  if (message.type === 'RESUME_PLAYBACK') {
    await resumePlayback();
    return { ok: true };
  }

  if (message.type === 'PLAYBACK_STARTED') {
    await markPlaybackStarted(message.playbackToken, message.currentTime);
    return { ok: true };
  }

  if (message.type === 'STOP_SEQUENCE') {
    await stopPlayback();
    return { ok: true };
  }

  return { ok: false, error: '지원하지 않는 요청입니다.', errorCode: 'unsupported_request' };
}

export async function handleCommand(command: CommandName): Promise<void> {
  if (command === 'capture-in') {
    await captureInFromCommand();
    return;
  }

  if (command === 'capture-out') {
    await captureOutFromCommand();
    return;
  }

  if (command === 'next-clip') {
    await nextSegment();
    return;
  }

  const playbackState = await loadPlaybackState();
  if (playbackState) {
    if (playbackState.status === 'paused') {
      await resumePlayback();
    } else {
      await pausePlayback();
    }
    return;
  }

  const store = await loadStore();
  const sequence = selectCaptureSequence(store.sequences, store.selectedSequenceId);
  if (sequence?.segments.length) {
    await startSequence(sequence.id, 0);
  }
}

function sendCommandToExtensionViews(command: CommandName): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'COMMAND_EVENT', name: command }, () => {
      const error = chrome.runtime.lastError;
      resolve(!error);
    });
  });
}

async function dispatchCommand(command: CommandName): Promise<void> {
  const deliveredToView = await sendCommandToExtensionViews(command);
  if (deliveredToView) {
    return;
  }

  await handleCommand(command);
}

function enableSidePanelBehavior(): void {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }

  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

chrome.runtime.onMessage.addListener((message: SnackTapeMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => sendResponse(failureResponse(error)));

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  enableSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  enableSidePanelBehavior();
});

chrome.commands?.onCommand.addListener((command) => {
  if (!isCommandName(command)) {
    return;
  }

  void dispatchCommand(command);
});
