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

test('startSequence rolls back pending playback when runtime handoff fails', async () => {
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

  assert.equal(store.getState().route, 'home');
  assert.equal(store.getState().playbackState, null);
  assert.equal(store.getState().playbackDisplay, null);
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
