import { getNextSegmentIndex } from '../shared/playback.js';
import {
  clearPlaybackState,
  loadPlaybackState,
  loadStore,
  savePlaybackState
} from '../shared/storage.js';
import type { Segment, Sequence, SnackTapeMessage, SnackTapeResponse } from '../shared/types.js';
import { validateSequence } from '../shared/validation.js';
import { parseYouTubeVideoId } from '../shared/youtube.js';

const MAX_MESSAGE_RETRIES = 12;
const MESSAGE_RETRY_DELAY_MS = 350;

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

function canonicalWatchUrl(segment: Segment): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(segment.videoId)}&t=${Math.floor(segment.startSeconds)}s`;
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
      files: ['contentScript.js']
    });
  } catch {
    // The declarative content script usually handles injection. This is only a best-effort recovery path.
  }
}

async function sendMessageWithRetries<T>(tabId: number, message: SnackTapeMessage): Promise<SnackTapeResponse<T>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_MESSAGE_RETRIES; attempt += 1) {
    try {
      const response = await sendMessageToTab<T>(tabId, message);
      if (!response.ok) {
        throw new Error(response.error ?? '요청을 처리하지 못했습니다.');
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 1) {
        await injectContentScript(tabId);
      }
      await delay(MESSAGE_RETRY_DELAY_MS);
    }
  }

  void lastError;
  throw new Error('YouTube 페이지와 연결할 수 없습니다. 새로고침 후 다시 시도해주세요.');
}

export async function startSequence(sequenceId: string, startIndex = 0): Promise<void> {
  const store = await loadStore();
  const sequence = getSequence(store.sequences, sequenceId);
  const errors = validateSequence(sequence);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  if (startIndex < 0 || startIndex >= sequence.segments.length) {
    throw new Error('재생할 구간을 찾을 수 없습니다.');
  }

  const activeTab = await getActiveTab();
  await playSegment(sequenceId, startIndex, activeTab.id);
}

export async function playSegment(sequenceId: string, segmentIndex: number, requestedTabId?: number): Promise<void> {
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

  await savePlaybackState({
    sequenceId,
    segmentIndex,
    tabId,
    status: 'playing',
    startedAt: Date.now(),
    playbackToken
  });

  const activeVideoId = tab?.url ? parseYouTubeVideoId(tab.url) : null;
  if (activeVideoId !== segment.videoId) {
    await chrome.tabs.update(tabId, { url: canonicalWatchUrl(segment) });
    await delay(700);
  }

  try {
    await sendMessageWithRetries(tabId, {
      type: 'PLAY_SEGMENT',
      segment,
      playbackToken
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
  if (!state || state.status !== 'playing') {
    return;
  }

  if (playbackToken && state.playbackToken && playbackToken !== state.playbackToken) {
    return;
  }

  const store = await loadStore();
  const sequence = getSequence(store.sequences, state.sequenceId);
  const nextIndex = getNextSegmentIndex(sequence, state.segmentIndex);

  if (nextIndex === null) {
    await stopPlayback(playbackToken);
    return;
  }

  const currentState = await loadPlaybackState();
  if (playbackToken && currentState?.playbackToken !== playbackToken) {
    return;
  }

  await playSegment(state.sequenceId, nextIndex, state.tabId);
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
    await startSequence(message.sequenceId, message.startIndex ?? 0);
    return { ok: true };
  }

  if (message.type === 'PLAY_NEXT' || message.type === 'SEGMENT_ENDED') {
    await nextSegment(message.playbackToken);
    return { ok: true };
  }

  if (message.type === 'STOP_SEQUENCE') {
    await stopPlayback();
    return { ok: true };
  }

  if (message.type === 'OPEN_EDITOR') {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }

  return { ok: false, error: '지원하지 않는 요청입니다.' };
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
