// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment } from './helpers.js';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.style = {};
    this.textContent = '';
    this.type = '';
    this.id = '';
    this.classList = { contains: () => false };
  }

  append(...children) {
    this.children.push(...children);
  }

  addEventListener(type, listener) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener();
    }
  }

  remove() {
    this.removed = true;
  }
}

function findByText(node, text) {
  if (node.textContent === text) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findByText(child, text);
    if (found) {
      return found;
    }
  }

  return null;
}

function installContentEnvironment({ playRejects = false, adChecksBeforeClear = 0, titleSelectors = {}, documentTitle = '테스트 영상 - YouTube' } = {}) {
  const runtimeMessages = [];
  const intervals = [];
  const windowListeners = {};
  const documentElement = new FakeElement('html');
  let adChecks = 0;
  const video = {
    readyState: 1,
    currentTime: 0,
    duration: 120,
    volume: 1,
    paused: true,
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] ??= [];
      this.listeners[type].push(listener);
    },
    removeEventListener(type, listener) {
      this.listeners[type] = (this.listeners[type] ?? []).filter((item) => item !== listener);
    },
    async play() {
      if (env.playRejects) {
        throw new Error('autoplay blocked');
      }
      this.paused = false;
    },
    pause() {
      this.paused = true;
    }
  };
  const env = {
    playRejects,
    runtimeMessages,
    intervals,
    windowListeners,
    documentElement,
    video,
    adChecksBeforeClear
  };

  globalThis.location = {
    href: 'https://www.youtube.com/watch?v=video-1',
    pathname: '/watch'
  };
  globalThis.HTMLMediaElement = { HAVE_METADATA: 1 };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.window = {
    __snacktapeContentScriptLoaded: false,
    setTimeout: (callback) => setTimeout(callback, 0),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (callback) => {
      intervals.push(callback);
      return intervals.length;
    },
    clearInterval: () => {},
    addEventListener(type, listener) {
      windowListeners[type] ??= [];
      windowListeners[type].push(listener);
    }
  };
  globalThis.document = {
    title: documentTitle,
    documentElement,
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => findById(documentElement, id),
    querySelector(selector) {
      if (selector === 'video') {
        return video;
      }
      if (selector === '.html5-video-player' && adChecksBeforeClear > 0) {
        adChecks += 1;
        return {
          classList: {
            contains: () => adChecks <= adChecksBeforeClear
          }
        };
      }
      if (selector in titleSelectors) {
        const value = titleSelectors[selector];
        if (value && typeof value === 'object') {
          return value;
        }
        return value ? { textContent: value } : null;
      }
      if (Object.keys(titleSelectors).length === 0 && selector === 'h1.ytd-watch-metadata yt-formatted-string') {
        return { textContent: '테스트 영상' };
      }
      return null;
    }
  };

  let contentListener = null;
  globalThis.chrome = {
    runtime: {
      lastError: null,
      onMessage: {
        addListener(listener) {
          contentListener = listener;
        }
      },
      sendMessage(message, callback) {
        runtimeMessages.push(message);
        callback?.({ ok: true });
      }
    }
  };

  function findById(node, id) {
    if (node.id === id) {
      return node;
    }
    for (const child of node.children ?? []) {
      const found = findById(child, id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  return {
    env,
    getContentListener: () => contentListener
  };
}

function sendContentMessage(listener, message) {
  return new Promise((resolve) => {
    listener(message, {}, resolve);
  });
}

test('content playback reports waiting and promotes playback after the continue overlay is clicked', async () => {
  const { env, getContentListener } = installContentEnvironment({ playRejects: true });
  await import('../src/content/contentScript.js?waiting');
  const listener = getContentListener();

  const response = await sendContentMessage(listener, {
    type: 'PLAY_SEGMENT',
    segment: makeSegment({ id: 'clip-waiting', videoId: 'video-1', startSeconds: 10, endSeconds: 20 }),
    playbackToken: 'token-waiting'
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.data, { status: 'waiting', currentTime: 10 });
  assert.equal(env.runtimeMessages.length, 0);

  env.playRejects = false;
  findByText(env.documentElement, '계속 재생').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(env.runtimeMessages, [
    { type: 'PLAYBACK_STARTED', playbackToken: 'token-waiting', currentTime: 10 }
  ]);
});

test('continue overlay keeps retry actionable after a failed manual play attempt', async () => {
  const { env, getContentListener } = installContentEnvironment({ playRejects: true });
  await import('../src/content/contentScript.js?retry-overlay');
  const listener = getContentListener();

  await sendContentMessage(listener, {
    type: 'PLAY_SEGMENT',
    segment: makeSegment({ id: 'clip-retry', videoId: 'video-1', startSeconds: 10, endSeconds: 20 }),
    playbackToken: 'token-retry'
  });

  findByText(env.documentElement, '계속 재생').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.notEqual(findByText(env.documentElement, '다시 시도'), null);
  assert.match(findByText(env.documentElement, 'YouTube 플레이어를 직접 한 번 클릭한 뒤 다시 시도해주세요.').textContent, /직접/);

  env.playRejects = false;
  findByText(env.documentElement, '다시 시도').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(env.runtimeMessages, [
    { type: 'PLAYBACK_STARTED', playbackToken: 'token-retry', currentTime: 10 }
  ]);
});

test('continue overlay uses playback language and accent theme from the message', async () => {
  const { env, getContentListener } = installContentEnvironment({ playRejects: true });
  await import('../src/content/contentScript.js?themed-overlay');
  const listener = getContentListener();

  await sendContentMessage(listener, {
    type: 'PLAY_SEGMENT',
    segment: makeSegment({ id: 'clip-theme', videoId: 'video-1', startSeconds: 10, endSeconds: 20 }),
    playbackToken: 'token-theme',
    language: 'en',
    accentKey: 'sky'
  });

  const label = findByText(env.documentElement, 'Continue SnackTape playback?');
  const button = findByText(env.documentElement, 'Continue');

  assert.notEqual(label, null);
  assert.equal(button.style.background, '#a8d8ff');

  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(findByText(env.documentElement, 'Click the YouTube player once, then try again.').textContent, 'Click the YouTube player once, then try again.');
  assert.notEqual(findByText(env.documentElement, 'Try again'), null);
});

test('content playback reports waiting while an ad is showing and starts after the ad clears', async () => {
  const { env, getContentListener } = installContentEnvironment({ adChecksBeforeClear: 1 });
  await import('../src/content/contentScript.js?ad-wait');
  const listener = getContentListener();

  const response = await sendContentMessage(listener, {
    type: 'PLAY_SEGMENT',
    segment: makeSegment({ id: 'clip-ad', videoId: 'video-1', startSeconds: 10, endSeconds: 20 }),
    playbackToken: 'token-ad'
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.data, { status: 'waiting', currentTime: 10 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(env.runtimeMessages, [
    { type: 'PLAYBACK_STARTED', playbackToken: 'token-ad', currentTime: 10 }
  ]);
});

test('content playback ends at the saved OUT boundary instead of before it', async () => {
  const { env, getContentListener } = installContentEnvironment();
  await import('../src/content/contentScript.js?boundary');
  const listener = getContentListener();

  const response = await sendContentMessage(listener, {
    type: 'PLAY_SEGMENT',
    segment: makeSegment({ id: 'clip-boundary', videoId: 'video-1', startSeconds: 10, endSeconds: 20 }),
    playbackToken: 'token-boundary'
  });

  assert.equal(response.ok, true);
  assert.deepEqual(response.data, { status: 'playing', currentTime: 10 });

  env.video.currentTime = 19.9;
  env.intervals.at(-1)();
  assert.equal(env.runtimeMessages.some((message) => message.type === 'SEGMENT_ENDED'), false);

  env.video.currentTime = 20;
  env.intervals.at(-1)();
  assert.deepEqual(env.runtimeMessages, [
    { type: 'SEGMENT_ENDED', playbackToken: 'token-boundary' }
  ]);
});

test('content playback clears background playback state when YouTube navigates away from the active video', async () => {
  const { env, getContentListener } = installContentEnvironment();
  await import('../src/content/contentScript.js?navigation');
  const listener = getContentListener();

  await sendContentMessage(listener, {
    type: 'PLAY_SEGMENT',
    segment: makeSegment({ id: 'clip-nav', videoId: 'video-1', startSeconds: 10, endSeconds: 20 }),
    playbackToken: 'token-nav'
  });

  globalThis.location.href = 'https://www.youtube.com/watch?v=video-2';
  for (const listener of env.windowListeners['yt-navigate-finish'] ?? []) {
    listener();
  }

  assert.equal(env.runtimeMessages.some((message) => message.type === 'STOP_SEQUENCE'), true);
});

test('content page info reads fallback YouTube title selectors before document title', async () => {
  const { getContentListener } = installContentEnvironment({
    titleSelectors: {
      'h1.ytd-watch-metadata yt-formatted-string': null,
      'meta[property="og:title"]': { getAttribute: (name) => (name === 'content' ? '메타 제목 - YouTube' : null) }
    },
    documentTitle: '브라우저 탭 제목 - YouTube'
  });
  await import('../src/content/contentScript.js?title-meta');
  const listener = getContentListener();

  const response = await sendContentMessage(listener, { type: 'GET_PAGE_INFO' });

  assert.equal(response.ok, true);
  assert.equal(response.data.title, '메타 제목');
});

test('content page info falls back to a visible generated title when YouTube title is empty', async () => {
  const { getContentListener } = installContentEnvironment({
    titleSelectors: {
      'h1.ytd-watch-metadata yt-formatted-string': null,
      'meta[property="og:title"]': null
    },
    documentTitle: ''
  });
  await import('../src/content/contentScript.js?title-generated');
  const listener = getContentListener();

  const response = await sendContentMessage(listener, { type: 'GET_PAGE_INFO' });

  assert.equal(response.ok, true);
  assert.equal(response.data.title, 'YouTube video-1');
});
