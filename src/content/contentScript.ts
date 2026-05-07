import { removeContinueOverlay, showContinueOverlay } from './overlay.js';
import type { PageInfo, PlaybackStartResult, Segment, SnackTapeMessage, SnackTapeResponse, VideoState } from '../shared/types.js';
import { parseYouTubeVideoId } from '../shared/youtube.js';

declare global {
  interface Window {
    __snacktapeContentScriptLoaded?: boolean;
  }
}

let activeToken: string | null = null;
let activeSegmentVideoId: string | null = null;
let cleanupPlayback: (() => void) | null = null;
let lastHref = location.href;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getVideo(): HTMLVideoElement | null {
  return document.querySelector('video');
}

function roundTime(value: number): number {
  return Math.round(value * 100) / 100;
}

function isAdShowing(): boolean {
  const player = document.querySelector('.html5-video-player');
  if (player?.classList.contains('ad-showing')) {
    return true;
  }

  return Boolean(
    document.querySelector('.ytp-ad-player-overlay, .ytp-ad-preview-container, .ytp-ad-module, .video-ads .ytp-ad-text')
  );
}

async function waitUntilNoAd(timeoutMs = 120000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!isAdShowing()) {
      return;
    }

    await delay(500);
  }

  throw new Error('광고가 끝난 뒤 다시 시도해주세요.');
}

function waitForVideoElement(timeoutMs = 10000): Promise<HTMLVideoElement> {
  const existing = getVideo();
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error('YouTube 영상 플레이어를 찾을 수 없습니다.'));
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      const video = getVideo();
      if (!video) {
        return;
      }

      window.clearTimeout(timeout);
      observer.disconnect();
      resolve(video);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

function waitForMetadata(video: HTMLVideoElement, timeoutMs = 5000): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('영상 정보를 준비하지 못했습니다.'));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('canplay', onReady);
    };

    const onReady = () => {
      cleanup();
      resolve();
    };

    video.addEventListener('loadedmetadata', onReady, { once: true });
    video.addEventListener('canplay', onReady, { once: true });
  });
}

async function waitForSegmentVideo(videoId: string, timeoutMs = 12000): Promise<HTMLVideoElement> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (parseYouTubeVideoId(location.href) === videoId) {
      await delay(400);
      const video = await waitForVideoElement(Math.max(500, deadline - Date.now()));
      await waitForMetadata(video, Math.max(500, deadline - Date.now()));
      return video;
    }

    await delay(250);
  }

  throw new Error('대상 YouTube 영상을 준비하지 못했습니다.');
}

function getTitle(): string {
  const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
  const title = titleElement?.textContent?.trim();
  if (title) {
    return title;
  }

  return document.title.replace(/\s+-\s+YouTube$/, '').trim();
}

function getChannel(): string {
  const channelElement = document.querySelector('#owner ytd-channel-name a, ytd-video-owner-renderer ytd-channel-name a');
  return channelElement?.textContent?.trim() ?? '';
}

function getVideoState(): VideoState {
  const video = getVideo();

  return {
    videoId: parseYouTubeVideoId(location.href),
    title: getTitle(),
    channel: getChannel(),
    currentTime: video ? roundTime(video.currentTime) : 0,
    duration: video && Number.isFinite(video.duration) ? roundTime(video.duration) : 0,
    paused: video?.paused ?? true
  };
}

function getPageInfo(): PageInfo {
  const video = getVideo();
  const videoId = parseYouTubeVideoId(location.href);

  return {
    isYouTubeVideoPage: Boolean(videoId) && location.pathname === '/watch',
    videoId,
    title: getTitle(),
    url: location.href,
    currentTime: video ? roundTime(video.currentTime) : null,
    duration: video && Number.isFinite(video.duration) ? roundTime(video.duration) : null
  };
}

function sendMessage(message: SnackTapeMessage): void {
  chrome.runtime.sendMessage(message, () => {
    // Ignore disconnected receivers. Playback cleanup is idempotent on the background side.
    void chrome.runtime.lastError;
  });
}

function clearPlayback(): void {
  if (cleanupPlayback) {
    cleanupPlayback();
    cleanupPlayback = null;
  }

  activeToken = null;
  activeSegmentVideoId = null;
  removeContinueOverlay();
}

async function tryPlay(video: HTMLVideoElement, playbackToken?: string): Promise<PlaybackStartResult['status']> {
  try {
    await video.play();
    removeContinueOverlay();
    return 'playing';
  } catch {
    showContinueOverlay(async () => {
      await video.play();
      removeContinueOverlay();
      if (playbackToken) {
        sendMessage({ type: 'PLAYBACK_STARTED', playbackToken, currentTime: roundTime(video.currentTime) });
      }
    });
    return 'waiting';
  }
}

async function startReadySegment(
  segment: Segment,
  playbackToken: string,
  video: HTMLVideoElement,
  fadeOut: boolean,
  fadeOutSeconds: number
): Promise<PlaybackStartResult> {
  const targetStart = Math.max(0, segment.startSeconds);
  video.currentTime = targetStart;
  activeToken = playbackToken;
  activeSegmentVideoId = segment.videoId;

  let finished = false;
  const originalVolume = video.volume;
  const finish = () => {
    if (finished || activeToken !== playbackToken) {
      return;
    }

    finished = true;
    clearPlayback();
    sendMessage({ type: 'SEGMENT_ENDED', playbackToken });
  };

  const endedHandler = () => {
    if (!segment.endSeconds || segment.endSeconds <= 0) {
      finish();
    }
  };

  const interval = window.setInterval(() => {
    if (activeToken !== playbackToken) {
      window.clearInterval(interval);
      return;
    }

    if (fadeOut && segment.endSeconds && segment.endSeconds > 0 && fadeOutSeconds > 0) {
      const remainingSeconds = segment.endSeconds - video.currentTime;
      if (remainingSeconds <= fadeOutSeconds) {
        const ratio = Math.max(0, remainingSeconds / fadeOutSeconds);
        video.volume = Math.min(originalVolume, Math.max(0, originalVolume * ratio));
      } else if (video.volume !== originalVolume) {
        video.volume = originalVolume;
      }
    }

    if (segment.endSeconds && segment.endSeconds > 0 && video.currentTime >= segment.endSeconds) {
      finish();
    }
  }, 250);

  video.addEventListener('ended', endedHandler);
  cleanupPlayback = () => {
    window.clearInterval(interval);
    video.removeEventListener('ended', endedHandler);
    video.volume = originalVolume;
  };

  const status = await tryPlay(video, playbackToken);
  return { status, currentTime: roundTime(video.currentTime) };
}

async function startAfterAdWait(
  segment: Segment,
  playbackToken: string,
  video: HTMLVideoElement,
  fadeOut: boolean,
  fadeOutSeconds: number
): Promise<void> {
  try {
    await waitUntilNoAd();
    if (activeToken !== playbackToken) {
      return;
    }

    const result = await startReadySegment(segment, playbackToken, video, fadeOut, fadeOutSeconds);
    if (result.status === 'playing') {
      sendMessage({ type: 'PLAYBACK_STARTED', playbackToken, currentTime: result.currentTime });
    }
  } catch (error) {
    if (activeToken === playbackToken) {
      clearPlayback();
      sendMessage({ type: 'STOP_SEQUENCE' });
    }
  }
}

async function playSegment(segment: Segment, playbackToken: string, fadeOut = false, fadeOutSeconds = 0.3): Promise<PlaybackStartResult> {
  clearPlayback();

  try {
    const video = await waitForSegmentVideo(segment.videoId);
    const targetStart = Math.max(0, segment.startSeconds);
    if (isAdShowing()) {
      activeToken = playbackToken;
      activeSegmentVideoId = segment.videoId;
      void startAfterAdWait(segment, playbackToken, video, fadeOut, fadeOutSeconds);
      return { status: 'waiting', currentTime: roundTime(targetStart) };
    }

    await waitUntilNoAd();
    return await startReadySegment(segment, playbackToken, video, fadeOut, fadeOutSeconds);
  } catch (error) {
    clearPlayback();
    throw error;
  }
}

async function handleMessage(message: SnackTapeMessage): Promise<SnackTapeResponse> {
  if (message.type === 'getVideoState') {
    return { ok: true, data: getVideoState() };
  }

  if (message.type === 'GET_PAGE_INFO') {
    return { ok: true, data: getPageInfo() };
  }

  if (message.type === 'GET_CURRENT_TIME') {
    const video = getVideo();
    return { ok: true, data: video ? roundTime(video.currentTime) : null };
  }

  if (message.type === 'seek') {
    const video = await waitForVideoElement();
    video.currentTime = Math.max(0, message.sec);
    return { ok: true };
  }

  if (message.type === 'play') {
    const video = await waitForVideoElement();
    await tryPlay(video);
    return { ok: true };
  }

  if (message.type === 'pause') {
    const video = getVideo();
    video?.pause();
    return { ok: true };
  }

  if (message.type === 'navigate') {
    location.href = `https://www.youtube.com/watch?v=${encodeURIComponent(message.videoId)}&t=${Math.floor(message.sec)}s`;
    return { ok: true };
  }

  if (message.type === 'PLAY_SEGMENT') {
    return {
      ok: true,
      data: await playSegment(message.segment, message.playbackToken, message.fadeOut, message.fadeOutSeconds)
    };
  }

  if (message.type === 'STOP_PLAYBACK') {
    const video = getVideo();
    clearPlayback();
    video?.pause();
    return { ok: true };
  }

  return { ok: false, error: '지원하지 않는 요청입니다.' };
}

function handleUrlChange(): void {
  if (location.href !== lastHref) {
    lastHref = location.href;
    if (activeSegmentVideoId && parseYouTubeVideoId(location.href) !== activeSegmentVideoId) {
      clearPlayback();
      sendMessage({ type: 'STOP_SEQUENCE' });
      return;
    }
    removeContinueOverlay();
  }
}

if (!window.__snacktapeContentScriptLoaded) {
  window.__snacktapeContentScriptLoaded = true;

  chrome.runtime.onMessage.addListener((message: SnackTapeMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        const messageText = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
        sendResponse({ ok: false, error: messageText });
      });

    return true;
  });

  window.addEventListener('yt-navigate-finish', () => {
    handleUrlChange();
  });

  window.setInterval(() => {
    handleUrlChange();
  }, 1000);
}
