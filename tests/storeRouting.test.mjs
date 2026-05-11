import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.mjs';

function installChromeStorage(initial = {}, options = {}) {
  const data = { ...initial };
  const failSetKeys = new Set(options.failSetKeys ?? []);
  const area = {
    get(key, callback) {
      callback({ [key]: data[key] });
    },
    set(value, callback) {
      const fails = Object.keys(value).some((key) => failSetKeys.has(key));
      if (fails) {
        globalThis.chrome.runtime.lastError = { message: options.failMessage ?? 'storage write failed' };
        callback?.();
        globalThis.chrome.runtime.lastError = null;
        return;
      }
      Object.assign(data, value);
      callback?.();
    },
    remove(key, callback) {
      delete data[key];
      callback?.();
    }
  };

  globalThis.chrome = {
    runtime: {
      lastError: null,
      sendMessage(_message, callback) {
        callback?.({ ok: true });
      }
    },
    storage: {
      local: area,
      session: area
    }
  };

  return data;
}

function baseSettings() {
  return {
    accentKey: 'peach',
    autoNext: true,
    fadeOut: true,
    shuffleByDefault: false,
    shortcutIn: 'I',
    shortcutOut: 'O',
    autoTitleFromCaptions: true
  };
}

test('openMixtape sends an empty mixtape to edit with that mixtape selected as save target', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const empty = makeSequence({ id: 'empty-sequence', name: '빈 믹스테이프', segments: [] });
  const filled = makeSequence({ id: 'filled-sequence', name: '채운 믹스테이프', segments: [makeSegment()] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [filled, empty],
      selectedSequenceId: filled.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [filled, empty],
      selectedSequenceId: filled.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };

  await store.openMixtape(empty.id);

  assert.equal(store.getState().route, 'capture');
  assert.equal(store.getState().store.selectedSequenceId, empty.id);
});

test('createMixtape rolls back visible state when store persistence fails', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-existing', name: '기존 믹스테이프', segments: [] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  }, {
    failSetKeys: [STORAGE_KEY],
    failMessage: 'quota exceeded'
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
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
    loading: false
  };

  await store.createMixtape();

  assert.equal(store.getState().store.sequences.length, 1);
  assert.equal(store.getState().store.selectedSequenceId, sequence.id);
  assert.equal(store.getState().settingsNotice.kind, 'error');
  assert.match(store.getState().settingsNotice.message, /quota exceeded/);
});

test('createMixtape uses the next unused visible number after deletions', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSequence({ id: 'sequence-1', name: '믹스테이프 1', segments: [] });
  const third = makeSequence({ id: 'sequence-3', name: '믹스테이프 3', segments: [] });
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [first, third],
      selectedSequenceId: first.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [first, third],
      selectedSequenceId: first.id
    },
    settings: baseSettings(),
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
    loading: false
  };

  await store.createMixtape();

  assert.deepEqual(storage[STORAGE_KEY].sequences.map((sequence) => sequence.name), ['믹스테이프 1', '믹스테이프 3', '믹스테이프 2']);
  assert.equal(store.getState().store.selectedSequenceId, storage[STORAGE_KEY].sequences[2].id);
});

test('openMixtape keeps filled mixtapes on playback', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const filled = makeSequence({ id: 'filled-sequence', name: '채운 믹스테이프', segments: [makeSegment()] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [filled],
      selectedSequenceId: filled.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [filled],
      selectedSequenceId: filled.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };

  await store.openMixtape(filled.id);

  assert.equal(store.getState().route, 'playback');
  assert.equal(store.getState().store.selectedSequenceId, filled.id);
});

test('openMixtape clears stale playback state from a different mixtape', async () => {
  const { PLAYBACK_STATE_KEY, STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSequence({ id: 'first-sequence', name: '재생 중이던 믹스테이프', segments: [makeSegment({ id: 'first-clip' })] });
  const second = makeSequence({ id: 'second-sequence', name: '열 믹스테이프', segments: [makeSegment({ id: 'second-clip' })] });
  const playbackState = {
    sequenceId: first.id,
    segmentIndex: 0,
    currentSegmentId: 'first-clip',
    status: 'playing',
    startedAt: 1700000000000
  };
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [first, second],
      selectedSequenceId: first.id
    },
    [PLAYBACK_STATE_KEY]: playbackState
  });
  const runtimeMessages = [];
  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessages.push(message);
    if (message.type === 'STOP_SEQUENCE') {
      delete storage[PLAYBACK_STATE_KEY];
    }
    callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [first, second],
      selectedSequenceId: first.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.openMixtape(second.id);

  assert.equal(store.getState().route, 'playback');
  assert.equal(store.getState().store.selectedSequenceId, second.id);
  assert.equal(store.getState().playbackState, null);
  assert.equal(storage[PLAYBACK_STATE_KEY], undefined);
  assert.deepEqual(runtimeMessages.map((message) => message.type), ['STOP_SEQUENCE']);
});

test('editMixtape sends any existing mixtape to edit with that mixtape selected as save target', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSequence({ id: 'first-sequence', name: '첫 믹스테이프', segments: [makeSegment({ id: 'first-clip' })] });
  const second = makeSequence({ id: 'second-sequence', name: '편집할 믹스테이프', segments: [makeSegment({ id: 'second-clip' })] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [first, second],
      selectedSequenceId: first.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [first, second],
      selectedSequenceId: first.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: {
      sequenceId: second.id,
      segmentIds: ['second-clip']
    },
    loading: false
  };

  await store.editMixtape(second.id);

  assert.equal(store.getState().route, 'capture');
  assert.equal(store.getState().store.selectedSequenceId, second.id);
  assert.equal(store.getState().queueEdit, null);
});

test('startSequence switches to playback before runtime playback handoff finishes', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-play', name: '재생할 믹스테이프', segments: [makeSegment({ id: 'clip-play' })] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });

  let runtimeMessage = null;
  let releaseRuntime = null;
  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessage = message;
    releaseRuntime = () => callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: { segmentId: 'clip-play' },
    renameEdit: { sequenceId: sequence.id },
    loading: false
  };

  const pending = store.startSequence(0, sequence.id);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(store.getState().route, 'playback');
  assert.equal(store.getState().store.selectedSequenceId, sequence.id);
  assert.equal(store.getState().queueEdit, null);
  assert.equal(store.getState().segmentEdit, null);
  assert.equal(store.getState().renameEdit, null);
  assert.equal(runtimeMessage.type, 'START_SEQUENCE');

  releaseRuntime();
  await pending;
});

test('startSequence clears pending playback and shows an error when runtime handoff fails', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-fail', name: '실패할 믹스테이프', segments: [makeSegment({ id: 'clip-fail' })] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });

  globalThis.chrome.runtime.sendMessage = (_message, callback) => {
    callback({ ok: false, error: 'runtime failed' });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.startSequence(0, sequence.id);

  assert.equal(store.getState().route, 'playback');
  assert.equal(store.getState().playbackState, null);
  assert.equal(store.getState().playbackDisplay, null);
  assert.equal(store.getState().playbackNotice.kind, 'error');
  assert.match(store.getState().playbackNotice.message, /runtime failed/);
});

test('retryPlaybackRecovery repeats a failed start handoff with the saved target', async () => {
  const { PLAYBACK_STATE_KEY, STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-retry-start',
    name: '재시도 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-a' }),
      makeSegment({ id: 'clip-b' })
    ]
  });
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });
  const runtimeMessages = [];
  let shouldFail = true;

  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessages.push(message);
    if (shouldFail) {
      callback({ ok: false, error: 'runtime failed' });
      return;
    }

    storage[PLAYBACK_STATE_KEY] = {
      sequenceId: sequence.id,
      segmentIndex: message.startIndex,
      currentSegmentId: 'clip-b',
      status: 'playing',
      startedAt: 1700000000000,
      mode: message.mode
    };
    callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.startSequence(1, sequence.id, 'shuffle');
  shouldFail = false;
  await store.retryPlaybackRecovery();

  assert.deepEqual(runtimeMessages.map((message) => [message.type, message.startIndex, message.mode]), [
    ['START_SEQUENCE', 1, 'shuffle'],
    ['START_SEQUENCE', 1, 'shuffle']
  ]);
  assert.equal(store.getState().playbackNotice, null);
  assert.equal(store.getState().playbackState.currentSegmentId, 'clip-b');
});

test('nextClip keeps the current playback and shows an error when runtime advance fails', async () => {
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-next-fail', name: '다음 실패 믹스테이프', segments: [makeSegment({ id: 'clip-next-fail' })] });
  const playbackState = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    currentSegmentId: 'clip-next-fail',
    status: 'playing',
    startedAt: 1700000000000
  };
  installChromeStorage();

  globalThis.chrome.runtime.sendMessage = (_message, callback) => {
    callback({ ok: false, error: 'next failed' });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.nextClip();

  assert.equal(store.getState().playbackState, playbackState);
  assert.equal(store.getState().playbackNotice.kind, 'error');
  assert.match(store.getState().playbackNotice.message, /next failed/);
});

test('syncPlaybackProgress exposes reconnect recovery when the playback tab is unreadable', async () => {
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-reconnect', name: '재연결 믹스테이프', segments: [makeSegment({ id: 'clip-reconnect' })] });
  installChromeStorage();
  let shouldFail = true;
  globalThis.chrome.tabs = {
    sendMessage(_tabId, _message, callback) {
      callback(shouldFail
        ? { ok: false, error: 'tab unavailable' }
        : {
            ok: true,
            data: {
              isYouTubeVideoPage: true,
              videoId: 'abc123XYZ_1',
              title: '재연결 클립',
              url: 'https://www.youtube.com/watch?v=abc123XYZ_1',
              currentTime: 12,
              duration: 120
            }
          });
    }
  };
  globalThis.chrome.scripting = {
    async executeScript() {}
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-reconnect',
      status: 'playing',
      startedAt: 1700000000000,
      tabId: 44,
      mode: 'sequence'
    },
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.syncPlaybackProgress();

  assert.equal(store.getState().playbackNotice.kind, 'error');
  assert.match(store.getState().playbackNotice.message, /YouTube/);
  assert.deepEqual(store.getState().playbackNotice.recovery, {
    type: 'start',
    sequenceId: sequence.id,
    startIndex: 0,
    mode: 'sequence'
  });

  shouldFail = false;
  await store.syncPlaybackProgress();

  assert.equal(store.getState().playbackNotice, null);
  assert.equal(store.getState().pageInfo.currentTime, 12);
});

test('syncPlaybackProgress exposes reconnect recovery when the playback tab changes video', async () => {
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-video-mismatch',
    name: '다른 영상 감지',
    segments: [makeSegment({ id: 'clip-video-mismatch', videoId: 'expected-video' })]
  });
  installChromeStorage();
  globalThis.chrome.tabs = {
    sendMessage(_tabId, _message, callback) {
      callback({
        ok: true,
        data: {
          isYouTubeVideoPage: true,
          videoId: 'other-video',
          title: 'Other video',
          url: 'https://www.youtube.com/watch?v=other-video',
          currentTime: 32,
          duration: 120
        }
      });
    }
  };
  globalThis.chrome.scripting = {
    async executeScript() {}
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'expected-video',
      title: 'Expected video',
      url: 'https://www.youtube.com/watch?v=expected-video',
      currentTime: 12,
      duration: 120
    },
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-video-mismatch',
      status: 'paused',
      startedAt: 1700000000000,
      tabId: 44,
      mode: 'sequence'
    },
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.syncPlaybackProgress();

  assert.equal(store.getState().pageInfo.videoId, 'other-video');
  assert.equal(store.getState().playbackNotice.kind, 'error');
  assert.match(store.getState().playbackNotice.message, /YouTube/);
  assert.deepEqual(store.getState().playbackNotice.recovery, {
    type: 'start',
    sequenceId: sequence.id,
    startIndex: 0,
    mode: 'sequence'
  });
});

test('stopPlayback shows an error when runtime stop fails', async () => {
  const { PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-stop-fail', name: '정지 실패 믹스테이프', segments: [makeSegment({ id: 'clip-stop-fail' })] });
  const playbackState = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    currentSegmentId: 'clip-stop-fail',
    status: 'playing',
    startedAt: 1700000000000,
    tabId: 55,
    playbackToken: 'token-stop-fail'
  };
  const storage = installChromeStorage({
    [PLAYBACK_STATE_KEY]: playbackState
  });

  globalThis.chrome.runtime.sendMessage = (_message, callback) => {
    callback({ ok: false, error: 'stop failed' });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.stopPlayback();

  assert.equal(store.getState().playbackState, playbackState);
  assert.equal(storage[PLAYBACK_STATE_KEY], playbackState);
  assert.equal(store.getState().playbackNotice.kind, 'error');
  assert.match(store.getState().playbackNotice.message, /stop failed/);
});

test('seekPlayback sends an absolute segment time and refreshes playback state', async () => {
  const { PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-store-seek',
    name: '스토어 탐색 믹스테이프',
    segments: [makeSegment({ id: 'clip-store-seek', videoId: 'video-1', startSeconds: 10, endSeconds: 20 })]
  });
  const playbackState = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    currentSegmentId: 'clip-store-seek',
    status: 'playing',
    startedAt: 1700000000000,
    tabId: 55,
    playbackToken: 'token-store-seek'
  };
  const storage = installChromeStorage({
    [PLAYBACK_STATE_KEY]: playbackState
  });
  const runtimeMessages = [];
  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessages.push(message);
    if (message.type === 'SEEK_PLAYBACK') {
      storage[PLAYBACK_STATE_KEY] = {
        ...playbackState,
        startedAt: 1700000005000
      };
    }
    callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.seekPlayback(15);

  assert.deepEqual(runtimeMessages, [{ type: 'SEEK_PLAYBACK', sec: 15 }]);
  assert.equal(store.getState().playbackState.startedAt, 1700000005000);
  assert.equal(store.getState().playbackNotice, null);
});

test('pausePlayback and resumePlayback send runtime commands without clearing playback', async () => {
  const { PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-store-pause',
    name: '스토어 일시정지 믹스테이프',
    segments: [makeSegment({ id: 'clip-store-pause', videoId: 'video-1' })]
  });
  const playingState = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    currentSegmentId: 'clip-store-pause',
    status: 'playing',
    startedAt: 1700000000000,
    tabId: 55,
    playbackToken: 'token-store-pause'
  };
  const pausedState = {
    ...playingState,
    status: 'paused',
    startedAt: 1700000003000
  };
  const storage = installChromeStorage({
    [PLAYBACK_STATE_KEY]: playingState
  });
  const runtimeMessages = [];
  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessages.push(message);
    if (message.type === 'PAUSE_PLAYBACK') {
      storage[PLAYBACK_STATE_KEY] = pausedState;
    }
    if (message.type === 'RESUME_PLAYBACK') {
      storage[PLAYBACK_STATE_KEY] = {
        ...playingState,
        status: 'playing',
        startedAt: 1700000004000
      };
    }
    callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: playingState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.pausePlayback();
  await store.resumePlayback();

  assert.deepEqual(runtimeMessages.map((message) => message.type), ['PAUSE_PLAYBACK', 'RESUME_PLAYBACK']);
  assert.equal(store.getState().playbackState.status, 'playing');
  assert.equal(store.getState().playbackState.startedAt, 1700000004000);
  assert.equal(store.getState().playbackNotice, null);
});

test('editPlaybackSegment opens the edit tab for the selected playback clip', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-edit-playback-segment',
    name: '재생 구간 편집',
    segments: [makeSegment({ id: 'clip-edit-playback' })]
  });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.editPlaybackSegment(sequence.id, 'clip-edit-playback');

  assert.equal(store.getState().route, 'capture');
  assert.equal(store.getState().store.selectedSequenceId, sequence.id);
  assert.deepEqual(store.getState().segmentEdit, { segmentId: 'clip-edit-playback' });
});

test('removePlaybackQueueSegment removes non-current rows from the active session queue without resurrecting removed clips', async () => {
  const { PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-remove-playback-queue',
    name: '세션 큐 제거',
    segments: [
      makeSegment({ id: 'clip-current' }),
      makeSegment({ id: 'clip-remove' }),
      makeSegment({ id: 'clip-keep' }),
      makeSegment({ id: 'clip-remove-second' })
    ]
  });
  const playbackState = {
    sequenceId: sequence.id,
    segmentIndex: 0,
    currentSegmentId: 'clip-current',
    status: 'playing',
    startedAt: 1700000000000,
    tabId: 55,
    playbackToken: 'token-remove-playback-queue',
    mode: 'sequence',
    order: [0, 1, 2, 3],
    orderSegmentIds: ['clip-current', 'clip-remove', 'clip-keep', 'clip-remove-second'],
    orderPosition: 0,
    queueEdited: true
  };
  const storage = installChromeStorage({
    [PLAYBACK_STATE_KEY]: playbackState
  });
  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.removePlaybackQueueSegment('clip-remove');
  await store.removePlaybackQueueSegment('clip-remove-second');

  assert.deepEqual(storage[PLAYBACK_STATE_KEY].orderSegmentIds, ['clip-current', 'clip-keep']);
  assert.equal(storage[PLAYBACK_STATE_KEY].queueEdited, true);
  assert.equal(store.getState().playbackState.orderPosition, 0);
  assert.deepEqual(store.getState().playbackState.orderSegmentIds, ['clip-current', 'clip-keep']);
});

test('startQueueFrom starts playback from the displayed queue suffix', async () => {
  const { PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-queue-from',
    name: '큐에서 시작',
    segments: [
      makeSegment({ id: 'clip-a' }),
      makeSegment({ id: 'clip-b' }),
      makeSegment({ id: 'clip-c' })
    ]
  });
  const storage = installChromeStorage();
  const runtimeMessages = [];
  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessages.push(message);
    if (message.type === 'START_SEQUENCE') {
      storage[PLAYBACK_STATE_KEY] = {
        sequenceId: sequence.id,
        segmentIndex: 2,
        currentSegmentId: 'clip-c',
        status: 'playing',
        startedAt: 1700000000000,
        mode: 'sequence',
        order: [2, 0],
        orderSegmentIds: ['clip-c', 'clip-a'],
        orderPosition: 0,
        queueEdited: true
      };
    }
    callback({ ok: true });
  };
  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.startQueueFrom(sequence.id, 'clip-c', ['clip-c', 'clip-a']);

  assert.deepEqual(runtimeMessages, [{
    type: 'START_SEQUENCE',
    sequenceId: sequence.id,
    startIndex: 2,
    mode: 'sequence',
    orderSegmentIds: ['clip-c', 'clip-a'],
    queueEdited: true
  }]);
  assert.equal(store.getState().playbackState.currentSegmentId, 'clip-c');
  assert.deepEqual(store.getState().playbackState.orderSegmentIds, ['clip-c', 'clip-a']);
});

test('startSequence publishes a pending playback state immediately while runtime handoff is in flight', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-pending', name: '대기 믹스테이프', segments: [makeSegment({ id: 'clip-pending' })] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });

  let releaseRuntime = null;
  globalThis.chrome.runtime.sendMessage = (_message, callback) => {
    releaseRuntime = () => callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  const pending = store.startSequence(0, sequence.id);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(store.getState().route, 'playback');
  assert.equal(store.getState().playbackState.status, 'pending');
  assert.equal(store.getState().playbackDisplay.canStop, true);

  releaseRuntime();
  await pending;
});

test('startSequence uses shuffle mode when shuffleByDefault is enabled and no mode is supplied', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-shuffle-default', name: '랜덤 기본 믹스테이프', segments: [makeSegment({ id: 'clip-1' }), makeSegment({ id: 'clip-2' })] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });

  let runtimeMessage = null;
  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessage = message;
    callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: { ...baseSettings(), shuffleByDefault: true },
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.startSequence(0, sequence.id);

  assert.equal(runtimeMessage.mode, 'shuffle');
});

test('saveQueueEdit preserves active shuffle playback mode', async () => {
  const { PLAYBACK_STATE_KEY, STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-queue-shuffle',
    name: '큐 편집 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-1' }),
      makeSegment({ id: 'clip-2' }),
      makeSegment({ id: 'clip-3' })
    ]
  });
  const playbackState = {
    sequenceId: sequence.id,
    segmentIndex: 1,
    currentSegmentId: 'clip-2',
    status: 'playing',
    startedAt: 1700000000000,
    mode: 'shuffle',
    orderSegmentIds: ['clip-2', 'clip-1', 'clip-3'],
    orderPosition: 0
  };
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [PLAYBACK_STATE_KEY]: playbackState
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: {
      sequenceId: sequence.id,
      segmentIds: ['clip-3', 'clip-2', 'clip-1']
    },
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.saveQueueEdit();

  assert.equal(store.getState().playbackState.mode, 'shuffle');
  assert.equal(storage[PLAYBACK_STATE_KEY].mode, 'shuffle');
  assert.deepEqual(storage[PLAYBACK_STATE_KEY].orderSegmentIds, ['clip-3', 'clip-2', 'clip-1']);
  assert.equal(storage[PLAYBACK_STATE_KEY].orderPosition, 1);
});

test('saveQueueEdit updates only the active playback queue without reordering the saved mixtape', async () => {
  const { PLAYBACK_STATE_KEY, STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-session-queue',
    name: '세션 큐 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-a' }),
      makeSegment({ id: 'clip-b' }),
      makeSegment({ id: 'clip-c' })
    ]
  });
  const playbackState = {
    sequenceId: sequence.id,
    segmentIndex: 1,
    currentSegmentId: 'clip-b',
    status: 'playing',
    startedAt: 1700000000000,
    mode: 'sequence',
    orderSegmentIds: ['clip-a', 'clip-b', 'clip-c'],
    orderPosition: 1
  };
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [PLAYBACK_STATE_KEY]: playbackState
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: {
      sequenceId: sequence.id,
      segmentIds: ['clip-c', 'clip-b', 'clip-a'],
      baseSegmentIds: ['clip-a', 'clip-b', 'clip-c']
    },
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.saveQueueEdit();

  assert.deepEqual(store.getState().store.sequences[0].segments.map((segment) => segment.id), ['clip-a', 'clip-b', 'clip-c']);
  assert.deepEqual(storage[STORAGE_KEY].sequences[0].segments.map((segment) => segment.id), ['clip-a', 'clip-b', 'clip-c']);
  assert.deepEqual(store.getState().playbackState.orderSegmentIds, ['clip-c', 'clip-b', 'clip-a']);
  assert.equal(store.getState().playbackState.queueEdited, true);
  assert.deepEqual(storage[PLAYBACK_STATE_KEY].orderSegmentIds, ['clip-c', 'clip-b', 'clip-a']);
  assert.equal(storage[PLAYBACK_STATE_KEY].queueEdited, true);
  assert.equal(storage[PLAYBACK_STATE_KEY].currentSegmentId, 'clip-b');
  assert.equal(storage[PLAYBACK_STATE_KEY].segmentIndex, 1);
  assert.equal(storage[PLAYBACK_STATE_KEY].orderPosition, 1);
  assert.equal(store.getState().queueEdit, null);
});

test('beginQueueEdit starts from the active playback queue instead of the saved mixtape order', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-active-queue',
    name: '현재 큐 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-a' }),
      makeSegment({ id: 'clip-b' }),
      makeSegment({ id: 'clip-c' })
    ]
  });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 2,
      currentSegmentId: 'clip-c',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'sequence',
      orderSegmentIds: ['clip-c', 'clip-b', 'clip-a'],
      orderPosition: 0
    },
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  store.beginQueueEdit(sequence.id);

  assert.deepEqual(store.getState().queueEdit.segmentIds, ['clip-c', 'clip-b', 'clip-a']);
});

test('beginRenameMixtape opens the edit tab with the selected mixtape rename field active', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSequence({ id: 'first-sequence', name: '첫 믹스테이프', segments: [makeSegment({ id: 'first-clip' })] });
  const second = makeSequence({ id: 'second-sequence', name: '이름 바꿀 믹스테이프', segments: [makeSegment({ id: 'second-clip' })] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [first, second],
      selectedSequenceId: first.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [first, second],
      selectedSequenceId: first.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: {
      sequenceId: second.id,
      segmentIds: ['second-clip']
    },
    segmentEdit: { segmentId: 'second-clip' },
    renameEdit: null,
    loading: false
  };

  await store.beginRenameMixtape(second.id);

  assert.equal(store.getState().route, 'capture');
  assert.equal(store.getState().store.selectedSequenceId, second.id);
  assert.deepEqual(store.getState().renameEdit, { sequenceId: second.id });
  assert.equal(store.getState().queueEdit, null);
  assert.equal(store.getState().segmentEdit, null);
});

test('renameMixtape trims and saves the selected mixtape name', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-rename', name: '이전 이름', segments: [makeSegment()] });
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'capture',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: { sequenceId: sequence.id },
    loading: false
  };

  await store.renameMixtape(sequence.id, '  새 믹스테이프  ');

  assert.equal(storage[STORAGE_KEY].sequences[0].name, '새 믹스테이프');
  assert.equal(store.getState().store.sequences[0].name, '새 믹스테이프');
  assert.equal(store.getState().renameEdit, null);
});

test('renameMixtape restores the previous name when store persistence fails', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-rename-fail', name: '이전 이름', segments: [makeSegment()] });
  installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  }, {
    failSetKeys: [STORAGE_KEY],
    failMessage: 'quota exceeded'
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'capture',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: { sequenceId: sequence.id },
    captureNotice: null,
    settingsNotice: null,
    loading: false
  };

  await store.renameMixtape(sequence.id, '새 이름');

  assert.equal(store.getState().store.sequences[0].name, '이전 이름');
  assert.deepEqual(store.getState().renameEdit, { sequenceId: sequence.id });
  assert.equal(store.getState().captureNotice.kind, 'error');
  assert.match(store.getState().captureNotice.message, /quota exceeded/);
});

test('deleteMixtape removes the selected mixtape and clears its playback state', async () => {
  const { PLAYBACK_STATE_KEY, STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSequence({ id: 'first-sequence', name: '남길 믹스테이프', segments: [makeSegment({ id: 'first-clip' })] });
  const second = makeSequence({ id: 'second-sequence', name: '삭제할 믹스테이프', segments: [makeSegment({ id: 'second-clip' })] });
  const playbackState = {
    sequenceId: second.id,
    segmentIndex: 0,
    currentSegmentId: 'second-clip',
    status: 'playing',
    startedAt: 1700000000000
  };
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [first, second],
      selectedSequenceId: second.id
    },
    [PLAYBACK_STATE_KEY]: playbackState
  });
  const runtimeMessages = [];
  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessages.push(message);
    if (message.type === 'STOP_SEQUENCE') {
      delete storage[PLAYBACK_STATE_KEY];
    }
    callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'capture',
    store: {
      sequences: [first, second],
      selectedSequenceId: second.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: { segmentId: 'second-clip' },
    loading: false
  };

  await store.deleteMixtape(second.id);

  assert.deepEqual(storage[STORAGE_KEY].sequences.map((sequence) => sequence.id), [first.id]);
  assert.equal(storage[STORAGE_KEY].selectedSequenceId, first.id);
  assert.equal(storage[PLAYBACK_STATE_KEY], undefined);
  assert.equal(store.getState().route, 'capture');
  assert.equal(store.getState().store.selectedSequenceId, first.id);
  assert.equal(store.getState().segmentEdit, null);
  assert.equal(store.getState().playbackState, null);
  assert.deepEqual(runtimeMessages.map((message) => message.type), ['STOP_SEQUENCE']);
});

test('deleteMixtape keeps the current mixtape and playback when store persistence fails', async () => {
  const { PLAYBACK_STATE_KEY, STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSequence({ id: 'first-sequence', name: '남길 믹스테이프', segments: [makeSegment({ id: 'first-clip' })] });
  const second = makeSequence({ id: 'second-sequence', name: '삭제 실패 믹스테이프', segments: [makeSegment({ id: 'second-clip' })] });
  const playbackState = {
    sequenceId: second.id,
    segmentIndex: 0,
    currentSegmentId: 'second-clip',
    status: 'playing',
    startedAt: 1700000000000
  };
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [first, second],
      selectedSequenceId: second.id
    },
    [PLAYBACK_STATE_KEY]: playbackState
  }, {
    failSetKeys: [STORAGE_KEY],
    failMessage: 'quota exceeded'
  });
  const runtimeMessages = [];
  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessages.push(message);
    callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'capture',
    store: {
      sequences: [first, second],
      selectedSequenceId: second.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: { segmentId: 'second-clip' },
    renameEdit: null,
    captureNotice: null,
    settingsNotice: null,
    loading: false
  };

  await store.deleteMixtape(second.id);

  assert.deepEqual(storage[STORAGE_KEY].sequences.map((sequence) => sequence.id), [first.id, second.id]);
  assert.equal(storage[PLAYBACK_STATE_KEY].sequenceId, second.id);
  assert.deepEqual(store.getState().store.sequences.map((sequence) => sequence.id), [first.id, second.id]);
  assert.equal(store.getState().store.selectedSequenceId, second.id);
  assert.equal(store.getState().playbackState.sequenceId, second.id);
  assert.deepEqual(runtimeMessages, []);
  assert.equal(store.getState().captureNotice.kind, 'error');
});

test('deleteMixtape removes the final mixtape instead of recreating a default one', async () => {
  const { PLAYBACK_STATE_KEY, STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const only = makeSequence({ id: 'only-sequence', name: '마지막 믹스테이프', segments: [makeSegment({ id: 'only-clip' })] });
  const playbackState = {
    sequenceId: only.id,
    segmentIndex: 0,
    currentSegmentId: 'only-clip',
    status: 'playing',
    startedAt: 1700000000000
  };
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [only],
      selectedSequenceId: only.id
    },
    [PLAYBACK_STATE_KEY]: playbackState
  });
  globalThis.chrome.runtime.sendMessage = (message, callback) => {
    if (message.type === 'STOP_SEQUENCE') {
      delete storage[PLAYBACK_STATE_KEY];
    }
    callback({ ok: true });
  };

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'capture',
    store: {
      sequences: [only],
      selectedSequenceId: only.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: { segmentId: 'only-clip' },
    renameEdit: { sequenceId: only.id },
    loading: false
  };

  await store.deleteMixtape(only.id);

  assert.deepEqual(storage[STORAGE_KEY].sequences, []);
  assert.equal(storage[STORAGE_KEY].selectedSequenceId, null);
  assert.equal(storage[PLAYBACK_STATE_KEY], undefined);
  assert.equal(store.getState().route, 'home');
  assert.deepEqual(store.getState().store.sequences, []);
  assert.equal(store.getState().store.selectedSequenceId, null);
  assert.equal(store.getState().segmentEdit, null);
  assert.equal(store.getState().renameEdit, null);
  assert.equal(store.getState().playbackState, null);
});

test('deleteMixtape clears a deleted mixtape from the default save target', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSequence({ id: 'first-sequence', name: '남길 믹스테이프', segments: [makeSegment({ id: 'first-clip' })] });
  const second = makeSequence({ id: 'second-sequence', name: '기본 저장 위치', segments: [makeSegment({ id: 'second-clip' })] });
  const settings = { ...baseSettings(), defaultMixtapeId: second.id };
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [first, second],
      selectedSequenceId: first.id
    },
    [SETTINGS_KEY]: settings
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'capture',
    store: {
      sequences: [first, second],
      selectedSequenceId: first.id
    },
    settings,
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.deleteMixtape(second.id);

  assert.equal(store.getState().settings.defaultMixtapeId, undefined);
  assert.equal(storage[SETTINGS_KEY].defaultMixtapeId, undefined);
});

test('duplicateMixtape creates an independent copied mixtape with fresh ids', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const original = makeSequence({
    id: 'source-sequence',
    name: 'ASMR 조각 모음',
    segments: [
      makeSegment({ id: 'clip-a', title: '첫 클립' }),
      makeSegment({ id: 'clip-b', title: '둘째 클립' })
    ]
  });
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [original],
      selectedSequenceId: original.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [original],
      selectedSequenceId: original.id
    },
    settings: baseSettings(),
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
    loading: false
  };

  await store.duplicateMixtape(original.id);

  const copy = storage[STORAGE_KEY].sequences[1];
  assert.equal(copy.name, 'ASMR 조각 모음 복사본');
  assert.equal(copy.segments.length, 2);
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.segments[0].id, 'clip-a');
  assert.notEqual(copy.segments[1].id, 'clip-b');
  assert.equal(store.getState().store.selectedSequenceId, copy.id);
});

test('mergeMixtapeInto appends copied clips to the target and removes the source', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const target = makeSequence({ id: 'target-sequence', name: 'Target', segments: [makeSegment({ id: 'target-clip', title: 'Target clip' })] });
  const source = makeSequence({ id: 'source-sequence', name: 'Source', segments: [makeSegment({ id: 'source-clip', title: 'Source clip' })] });
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [target, source],
      selectedSequenceId: source.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'home',
    store: {
      sequences: [target, source],
      selectedSequenceId: source.id
    },
    settings: baseSettings(),
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
    loading: false
  };

  await store.mergeMixtapeInto(source.id, target.id);

  assert.deepEqual(storage[STORAGE_KEY].sequences.map((sequence) => sequence.id), [target.id]);
  assert.equal(storage[STORAGE_KEY].sequences[0].segments.length, 2);
  assert.deepEqual(storage[STORAGE_KEY].sequences[0].segments.map((segment) => segment.title), ['Target clip', 'Source clip']);
  assert.notEqual(storage[STORAGE_KEY].sequences[0].segments[1].id, 'source-clip');
  assert.equal(store.getState().store.selectedSequenceId, target.id);
});

test('copySegmentToMixtape and moveSegmentToMixtape transfer clips between mixtapes', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const source = makeSequence({
    id: 'source-sequence',
    name: 'Source',
    segments: [makeSegment({ id: 'clip-a', title: 'Move me' }), makeSegment({ id: 'clip-b', title: 'Keep me' })]
  });
  const target = makeSequence({ id: 'target-sequence', name: 'Target', segments: [] });
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [source, target],
      selectedSequenceId: source.id
    }
  });

  const store = new SnackTapeAppStore();
  store.state = {
    route: 'capture',
    store: {
      sequences: [source, target],
      selectedSequenceId: source.id
    },
    settings: baseSettings(),
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
    loading: false
  };

  await store.copySegmentToMixtape('clip-a', target.id);
  await store.moveSegmentToMixtape('clip-b', target.id);

  const [nextSource, nextTarget] = storage[STORAGE_KEY].sequences;
  assert.deepEqual(nextSource.segments.map((segment) => segment.id), ['clip-a']);
  assert.deepEqual(nextTarget.segments.map((segment) => segment.title), ['Move me', 'Keep me']);
  assert.notEqual(nextTarget.segments[0].id, 'clip-a');
  assert.equal(nextTarget.segments[1].id, 'clip-b');
});

test('duplicateSelectedSegment copies a clip inside the selected mixtape with a fresh id', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSegment({ id: 'clip-a', title: 'Duplicate me', startSeconds: 10, endSeconds: 12 });
  const second = makeSegment({ id: 'clip-b', title: 'Keep me', startSeconds: 20, endSeconds: 24 });
  const sequence = makeSequence({
    id: 'selected-sequence',
    name: 'Selected',
    segments: [first, second]
  });
  const storage = installChromeStorage({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    route: 'capture',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
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
    loading: false
  };

  await store.duplicateSelectedSegment(first.id);

  const nextSegments = storage[STORAGE_KEY].sequences[0].segments;
  assert.deepEqual(nextSegments.map((segment) => segment.title), ['Duplicate me', 'Duplicate me', 'Keep me']);
  assert.notEqual(nextSegments[1].id, first.id);
  assert.equal(nextSegments[1].startSeconds, 10);
  assert.equal(nextSegments[1].endSeconds, 12);
  assert.equal(store.getState().store.selectedSequenceId, sequence.id);
});

test('updateSettings normalizes settings before publishing visible state', async () => {
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const storage = installChromeStorage();
  const store = new SnackTapeAppStore();
  store.state = {
    route: 'settings',
    store: null,
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };

  await store.updateSettings({
    accentKey: 'purple',
    language: 'fr',
    shortcutIn: 'Ctrl+Shift+P',
    shortcutOut: 'X'
  });

  assert.equal(store.getState().settings.accentKey, 'peach');
  assert.equal(store.getState().settings.language, 'ko');
  assert.equal(store.getState().settings.shortcutIn, 'Alt+I');
  assert.equal(store.getState().settings.shortcutOut, 'Alt+O');
  assert.equal(storage[SETTINGS_KEY].accentKey, 'peach');
  assert.equal(storage[SETTINGS_KEY].language, 'ko');
  assert.equal(storage[SETTINGS_KEY].shortcutIn, 'Alt+I');
  assert.equal(storage[SETTINGS_KEY].shortcutOut, 'Alt+O');
});

test('store refreshes playback when background reports playback state changed', async () => {
  const { PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSegment({ id: 'clip-1', title: 'First clip' });
  const second = makeSegment({ id: 'clip-2', title: 'Second clip' });
  const sequence = makeSequence({
    id: 'sequence-refresh-playback',
    name: 'Refresh Tape',
    segments: [first, second]
  });
  installChromeStorage({
    [PLAYBACK_STATE_KEY]: {
      sequenceId: sequence.id,
      segmentIndex: 1,
      currentSegmentId: second.id,
      tabId: 9,
      status: 'playing',
      startedAt: 2,
      playbackToken: 'token-2',
      mode: 'sequence',
      order: [0, 1],
      orderSegmentIds: [first.id, second.id],
      orderPosition: 1
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: null,
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: first.id,
      tabId: 9,
      status: 'playing',
      startedAt: 1,
      playbackToken: 'token-1',
      mode: 'sequence',
      order: [0, 1],
      orderSegmentIds: [first.id, second.id],
      orderPosition: 0
    },
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    captureNotice: null,
    settingsNotice: null,
    loading: false
  };

  await store.handleRuntimeMessage({ type: 'PLAYBACK_STATE_CHANGED' });

  assert.equal(store.getState().playbackState.currentSegmentId, second.id);
  assert.equal(store.getState().playbackDisplay.segmentTitle, 'Second clip');
});

test('store syncs playback progress from the playback tab instead of elapsed wall time', async () => {
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const segment = makeSegment({
    id: 'clip-progress-sync',
    title: 'Synced clip',
    videoId: 'video-progress',
    startSeconds: 10,
    endSeconds: 20
  });
  const sequence = makeSequence({
    id: 'sequence-progress-sync',
    name: 'Progress Sync Tape',
    segments: [segment]
  });
  installChromeStorage();
  const tabMessages = [];
  globalThis.chrome.tabs = {
    sendMessage(tabId, message, callback) {
      tabMessages.push({ tabId, message });
      callback({
        ok: true,
        data: {
          isYouTubeVideoPage: true,
          videoId: 'video-progress',
          title: 'Synced clip',
          url: 'https://www.youtube.com/watch?v=video-progress',
          currentTime: 11,
          duration: 120
        }
      });
    }
  };
  const store = new SnackTapeAppStore();
  store.state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: baseSettings(),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video-progress',
      title: 'Synced clip',
      url: 'https://www.youtube.com/watch?v=video-progress',
      currentTime: 18,
      duration: 120
    },
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: segment.id,
      tabId: 42,
      status: 'playing',
      startedAt: 1,
      playbackToken: 'token-progress',
      mode: 'sequence',
      order: [0],
      orderSegmentIds: [segment.id],
      orderPosition: 0
    },
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    captureNotice: null,
    settingsNotice: null,
    loading: false
  };

  await store.syncPlaybackProgress();

  assert.deepEqual(tabMessages, [{ tabId: 42, message: { type: 'GET_PAGE_INFO' } }]);
  assert.equal(store.getState().pageInfo.currentTime, 11);
});
