import type { PageInfo, SnackTapeMessage, SnackTapeResponse, VideoState } from '../shared/types.js';
import { parseYouTubeVideoId } from '../shared/youtube.js';

export type ActiveVideoResult = {
  tabId?: number;
  info: PageInfo;
  videoState: VideoState | null;
  error: string | null;
};

function roundTime(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function emptyPageInfo(): PageInfo {
  return {
    isYouTubeVideoPage: false,
    videoId: null,
    title: '',
    url: '',
    currentTime: null,
    duration: null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'YouTube 페이지를 확인할 수 없습니다.');
}

export function pageInfoFromTab(tab: chrome.tabs.Tab | null): PageInfo {
  const url = tab?.url ?? '';
  const videoId = parseYouTubeVideoId(url);
  let isWatchPage = false;

  try {
    isWatchPage = Boolean(videoId && new URL(url).pathname === '/watch');
  } catch {
    isWatchPage = false;
  }

  return {
    isYouTubeVideoPage: isWatchPage,
    videoId,
    title: tab?.title?.replace(/\s+-\s+YouTube$/, '').trim() ?? '',
    url,
    currentTime: null,
    duration: null,
  };
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

export function sendTabMessage<T>(tabId: number, message: SnackTapeMessage): Promise<SnackTapeResponse<T>> {
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

export function sendRuntimeMessage(message: SnackTapeMessage): Promise<SnackTapeResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: SnackTapeResponse | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        resolve({ ok: false, error: '확장 프로그램과 연결할 수 없습니다.' });
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
      files: ['content.js'],
    });
  } catch {
    // Best-effort recovery for tabs that were open before the extension was reloaded.
  }
}

async function readVideoState(tabId: number): Promise<VideoState> {
  const response = await sendTabMessage<VideoState>(tabId, { type: 'getVideoState' });
  if (!response.ok || !response.data) {
    throw new Error(response.error ?? 'YouTube 페이지와 연결할 수 없습니다.');
  }

  return response.data;
}

function activeVideoResult(tab: chrome.tabs.Tab, videoState: VideoState): ActiveVideoResult {
  return {
    tabId: tab.id,
    info: {
      isYouTubeVideoPage: Boolean(videoState.videoId),
      videoId: videoState.videoId,
      title: videoState.title,
      url: tab.url ?? '',
      currentTime: roundTime(videoState.currentTime),
      duration: roundTime(videoState.duration),
    },
    videoState,
    error: null,
  };
}

export async function getActiveVideoState(): Promise<ActiveVideoResult> {
  let tab: chrome.tabs.Tab | null;
  try {
    tab = await getActiveTab();
  } catch (error) {
    return {
      info: emptyPageInfo(),
      videoState: null,
      error: errorMessage(error),
    };
  }
  const fallback = pageInfoFromTab(tab);

  if (!tab?.id || !fallback.videoId) {
    return {
      tabId: tab?.id,
      info: fallback,
      videoState: null,
      error: null,
    };
  }

  try {
    return activeVideoResult(tab, await readVideoState(tab.id));
  } catch {
    await injectContentScript(tab.id);

    try {
      return activeVideoResult(tab, await readVideoState(tab.id));
    } catch {
      // Fall through to the original fallback shape below.
    }

    return {
      tabId: tab.id,
      info: fallback,
      videoState: null,
      error: 'YouTube 페이지와 연결할 수 없습니다. 새로고침 후 다시 시도해주세요.',
    };
  }
}
