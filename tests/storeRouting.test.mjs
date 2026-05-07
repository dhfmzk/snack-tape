import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.mjs';

function installChromeStorage(initial = {}) {
  const data = { ...initial };
  const area = {
    get(key, callback) {
      callback({ [key]: data[key] });
    },
    set(value, callback) {
      Object.assign(data, value);
      callback?.();
    },
    remove(key, callback) {
      delete data[key];
      callback?.();
    }
  };

  globalThis.chrome = {
    runtime: { lastError: null },
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
