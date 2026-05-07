import { createPlaybackOrder, getNextPlaybackStep } from '../shared/playback.js';
import { findYouTubePlaybackTab, isExtensionPageUrl } from '../shared/playbackTarget.js';
import {
  clearPlaybackState,
  loadPlaybackState,
  loadStore,
  savePlaybackState
} from '../shared/storage.js';
import type { PlaybackMode, PlaybackStartResult, PlaybackState, Segment, Sequence, SnackTapeMessage, SnackTapeResponse } from '../shared/types.js';
import { validateSequence } from '../shared/validation.js';
import { parseYouTubeVideoId } from '../shared/youtube.js';
import { loadSettings } from '../state/storage.js';

const MAX_MESSAGE_RETRIES = 12;
const MESSAGE_RETRY_DELAY_MS = 350;
const COMMAND_NAMES = ['capture-in', 'capture-out', 'play-pause', 'next-clip'] as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPlaybackToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
};

const FADE_OUT_SECONDS = 0.3;

function normalizePlaybackMode(mode: PlaybackMode | undefined): PlaybackMode {
  return mode === 'shuffle' ? 'shuffle' : 'sequence';
}

class ContentResponseError extends Error {}

async function playbackModeFromSettings(): Promise<PlaybackMode> {
  const settings = await loadSettings();
  return settings.shuffleByDefault ? 'shuffle' : 'sequence';
}

function canonicalWatchUrl(segment: Segment): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(segment.videoId)}&t=${Math.floor(segment.startSeconds)}s`;
}

function orderSegmentIds(sequence: Sequence, order: number[]): string[] {
  return order.map((index) => sequence.segments[index]?.id).filter((id): id is string => Boolean(id));
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
        throw new ContentResponseError(response.error ?? '요청을 처리하지 못했습니다.');
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
  throw new Error('YouTube 페이지와 연결할 수 없습니다. 새로고침 후 다시 시도해주세요.');
}

export async function startSequence(sequenceId: string, startIndex = 0, mode?: PlaybackMode, requestedTabId?: number): Promise<void> {
  const store = await loadStore();
  const sequence = getSequence(store.sequences, sequenceId);
  const errors = validateSequence(sequence);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  if (startIndex < 0 || startIndex >= sequence.segments.length) {
    throw new Error('재생할 구간을 찾을 수 없습니다.');
  }

  const playbackMode = mode ? normalizePlaybackMode(mode) : await playbackModeFromSettings();
  const order = createPlaybackOrder(sequence.segments.length, startIndex, playbackMode);
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
    orderSegmentIds: orderSegmentIds(sequence, order),
    orderPosition: 0
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
    orderPosition: playbackRequest?.orderPosition ?? previousState?.orderPosition ?? segmentIndex
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
      fadeOutSeconds: FADE_OUT_SECONDS
    });
    const startedTime = typeof response.data?.currentTime === 'number' && Number.isFinite(response.data.currentTime)
      ? response.data.currentTime
      : segment.startSeconds;
    const elapsedFromSegmentStart = Math.max(0, startedTime - segment.startSeconds);
    await savePlaybackState({
      ...playbackState,
      status: response.data?.status === 'waiting' ? 'waiting' : 'playing',
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
  if (!state || (state.status !== 'playing' && state.status !== 'waiting')) {
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
    orderPosition: nextStep.orderPosition
  });
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
    startedAt: Date.now() - Math.round(elapsedFromSegmentStart * 1000)
  });
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
}

async function handleMessage(message: SnackTapeMessage): Promise<SnackTapeResponse> {
  if (message.type === 'START_SEQUENCE') {
    await startSequence(
      message.sequenceId,
      message.startIndex ?? 0,
      message.mode ? normalizePlaybackMode(message.mode) : undefined,
      message.tabId
    );
    return { ok: true };
  }

  if (message.type === 'PLAY_NEXT' || message.type === 'SEGMENT_ENDED') {
    await nextSegment(message.playbackToken);
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

  return { ok: false, error: '지원하지 않는 요청입니다.' };
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
    .catch((error: unknown) => {
      const messageText = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
      sendResponse({ ok: false, error: messageText });
    });

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  enableSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  enableSidePanelBehavior();
});

chrome.commands?.onCommand.addListener((command) => {
  if (!COMMAND_NAMES.includes(command as (typeof COMMAND_NAMES)[number])) {
    return;
  }

  chrome.runtime.sendMessage({ type: 'COMMAND_EVENT', name: command }, () => {
    void chrome.runtime.lastError;
  });
});
