// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSequence } from './helpers.js';

function installChromeForCapture({ storage = {}, videoState, videoError = null, tabsQueryError = null, deferSet = false, failSetKeys = [], failMessage = 'storage write failed' } = {}) {
  const data = { ...storage };
  let releaseSet = null;
  const failingKeys = new Set(failSetKeys);
  globalThis.window = {
    setTimeout(callback) {
      return globalThis.setTimeout(callback, 0);
    }
  };
  const storageArea = {
    get(key, callback) {
      callback({ [key]: data[key] });
    },
    set(value, callback) {
      const fails = Object.keys(value).some((key) => failingKeys.has(key));
      if (fails) {
        globalThis.chrome.runtime.lastError = { message: failMessage };
        callback?.();
        globalThis.chrome.runtime.lastError = null;
        return;
      }
      Object.assign(data, value);
      if (deferSet) {
        releaseSet = callback ?? (() => {});
        return;
      }
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
      local: storageArea,
      session: storageArea
    },
    tabs: {
      async query() {
        if (tabsQueryError) {
          throw new Error(tabsQueryError);
        }
        return [{ id: 7, url: 'https://www.youtube.com/watch?v=video_12345', title: '테스트 영상 - YouTube' }];
      },
      sendMessage(_tabId, message, callback) {
        if (message.type === 'getVideoState') {
          if (videoError) {
            callback({ ok: false, error: videoError });
            return;
          }
          callback({ ok: true, data: videoState });
          return;
        }
        callback({ ok: true });
      }
    }
  };

  data.releaseSet = () => {
    releaseSet?.();
    releaseSet = null;
  };
  return data;
}

class FakeNode {
  constructor(text = '') {
    this.children = [];
    this.textContent = text;
  }

  append(...children) {
    this.children.push(...children);
  }
}

class FakeElement extends FakeNode {
  constructor(tagName) {
    super();
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.className = '';
    this.dataset = {};
    this.innerHTML = '';
    this.listeners = {};
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      }
    };
    this.value = '';
    this.disabled = false;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, listener) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener({ stopPropagation() {} });
    }
  }
}

function installDomShim() {
  globalThis.Node = FakeNode;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
    createTextNode: (text) => new FakeNode(String(text))
  };
}

function findByAriaLabel(node, label) {
  if (node.attributes?.['aria-label'] === label) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findByAriaLabel(child, label);
    if (found) {
      return found;
    }
  }

  return null;
}

function baseState(sequence) {
  return {
    route: 'capture',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    settings: {
      accentKey: 'peach',
      autoNext: true,
      fadeOut: true,
      shuffleByDefault: false,
      shortcutIn: 'I',
      shortcutOut: 'O',
      autoTitleFromCaptions: true
    },
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    draftOut: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };
}

test('captureIn stores the current YouTube time as the visible draft marker', async () => {
  const { SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', segments: [] });
  const storage = installChromeForCapture({
    videoState: {
      videoId: 'video_12345',
      title: '테스트 영상',
      channel: '채널',
      currentTime: 42.345,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  await store.captureIn();

  assert.equal(store.getState().draftIn, 42.345);
  assert.equal(storage[SEGMENT_DRAFT_KEY].videoId, 'video_12345');
  assert.equal(storage[SEGMENT_DRAFT_KEY].startSeconds, 42.345);
});

test('captureIn updates the visible draft marker before storage persistence finishes', async () => {
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', segments: [] });
  const storage = installChromeForCapture({
    deferSet: true,
    videoState: {
      videoId: 'video_12345',
      title: '테스트 영상',
      channel: '채널',
      currentTime: 42.345,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  const capture = store.captureIn();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(store.getState().draftIn, 42.345);

  storage.releaseSet();
  await capture;
});

test('captureIn uses cached page info immediately when active video refresh cannot read YouTube', async () => {
  const { SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', segments: [] });
  const storage = installChromeForCapture({
    videoError: 'Cannot connect to YouTube'
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video_12345',
      title: '캐시된 영상',
      url: 'https://www.youtube.com/watch?v=video_12345',
      currentTime: 12.345,
      duration: 300
    }
  };

  const capture = store.captureIn();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(store.getState().draftIn, 12.345);

  await capture;
  assert.equal(storage[SEGMENT_DRAFT_KEY].videoId, 'video_12345');
  assert.equal(storage[SEGMENT_DRAFT_KEY].startSeconds, 12.345);
});

test('captureOutPreview stores OUT without appending a clip', async () => {
  const { SEGMENT_DRAFT_KEY, STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', name: '저장 대상', segments: [] });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '저장할 영상',
      channel: '채널',
      currentTime: 45.9,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    draftIn: 42
  };

  await store.captureOutPreview();

  assert.equal(storage[STORAGE_KEY].sequences[0].segments.length, 0);
  assert.equal(storage[SEGMENT_DRAFT_KEY].startSeconds, 42);
  assert.equal(storage[SEGMENT_DRAFT_KEY].endSeconds, 45.9);
  assert.equal(store.getState().draftIn, 42);
  assert.equal(store.getState().draftOut, 45.9);
});

test('saveCaptureDraft appends a previewed clip and clears the draft', async () => {
  const { SEGMENT_DRAFT_KEY, STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-save-preview', name: '저장 대상', segments: [] });
  const storage = installChromeForCapture({
    storage: {
      [SEGMENT_DRAFT_KEY]: {
        videoId: 'video_12345',
        startSeconds: 42,
        endSeconds: 45.9,
        updatedAt: 1700000000000
      },
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '저장할 영상',
      channel: '채널',
      currentTime: 45.9,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video_12345',
      title: '저장할 영상',
      url: 'https://www.youtube.com/watch?v=video_12345',
      currentTime: 45.9,
      duration: 300
    },
    videoState: {
      videoId: 'video_12345',
      title: '저장할 영상',
      channel: '채널',
      currentTime: 45.9,
      duration: 300,
      paused: false
    },
    draftIn: 42,
    draftOut: 45.9
  };

  await store.saveCaptureDraft();

  const savedSequence = storage[STORAGE_KEY].sequences[0];
  assert.equal(savedSequence.id, sequence.id);
  assert.equal(savedSequence.segments.length, 1);
  assert.equal(savedSequence.segments[0].title, '저장할 영상');
  assert.equal(savedSequence.segments[0].channel, '채널');
  assert.equal(savedSequence.segments[0].startSeconds, 42);
  assert.equal(savedSequence.segments[0].endSeconds, 45.9);
  assert.equal(store.getState().draftIn, null);
  assert.equal(store.getState().draftOut, null);
  assert.equal(storage[SEGMENT_DRAFT_KEY], undefined);
});

test('captureOutAndSave still supports the command shortcut direct-save path', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-direct-save', name: '저장 대상', segments: [] });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '저장할 영상',
      channel: '채널',
      currentTime: 45.9,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    draftIn: 42
  };

  await store.captureOutAndSave();

  assert.equal(storage[STORAGE_KEY].sequences[0].segments.length, 1);
  assert.equal(storage[STORAGE_KEY].sequences[0].segments[0].endSeconds, 45.9);
});

test('captureOutAndSave still saves when OUT is captured at the same timestamp as IN', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', name: '저장 대상', segments: [] });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '멈춘 영상',
      channel: '채널',
      currentTime: 42,
      duration: 300,
      paused: true
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    draftIn: 42
  };

  await store.captureOutAndSave();

  const savedSegment = storage[STORAGE_KEY].sequences[0].segments[0];
  assert.equal(storage[STORAGE_KEY].sequences[0].segments.length, 1);
  assert.equal(savedSegment.startSeconds, 42);
  assert.equal(savedSegment.endSeconds, 42 + 1 / 30);
  assert.equal(store.getState().draftIn, null);
});

test('captureOutAndSave uses cached page info when active video refresh cannot read YouTube', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', name: '저장 대상', segments: [] });
  const storage = installChromeForCapture({
    videoError: 'Cannot connect to YouTube',
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video_12345',
      title: '캐시된 영상',
      url: 'https://www.youtube.com/watch?v=video_12345',
      currentTime: 45.678,
      duration: 300
    },
    draftIn: 42
  };

  await store.captureOutAndSave();

  const savedSegment = storage[STORAGE_KEY].sequences[0].segments[0];
  assert.equal(savedSegment.title, '캐시된 영상');
  assert.equal(savedSegment.startSeconds, 42);
  assert.equal(savedSegment.endSeconds, 45.678);
  assert.equal(store.getState().draftIn, null);
});

test('captureOutAndSave reports missing preconditions instead of returning silently', async () => {
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', name: '저장 대상', segments: [] });
  installChromeForCapture({
    videoState: {
      videoId: 'video_12345',
      title: '저장할 영상',
      channel: '채널',
      currentTime: 45.9,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  await store.captureOutAndSave();

  assert.equal(store.getState().captureNotice.kind, 'error');
  assert.match(store.getState().captureNotice.message, /IN/);

  installChromeForCapture({
    videoState: {
      videoId: 'video_12345',
      title: '저장할 영상',
      channel: '채널',
      currentTime: 45.9,
      duration: 300,
      paused: false
    }
  });
  const noTargetStore = new SnackTapeAppStore();
  noTargetStore.state = {
    ...baseState(sequence),
    store: { sequences: [], selectedSequenceId: null },
    draftIn: 42
  };

  await noTargetStore.captureOutAndSave();

  assert.equal(noTargetStore.getState().captureNotice.kind, 'error');
  assert.match(noTargetStore.getState().captureNotice.message, /믹스테이프/);

  installChromeForCapture({
    videoError: 'Cannot connect to YouTube'
  });
  const unreadableStore = new SnackTapeAppStore();
  unreadableStore.state = {
    ...baseState(sequence),
    draftIn: 42
  };

  await unreadableStore.captureOutAndSave();

  assert.equal(unreadableStore.getState().captureNotice.kind, 'error');
  assert.match(unreadableStore.getState().captureNotice.message, /시간/);

  installChromeForCapture({
    videoState: {
      videoId: 'video_12345',
      title: '저장할 영상',
      channel: '채널',
      currentTime: 45.9,
      duration: 300,
      paused: false
    }
  });
  const invalidStore = new SnackTapeAppStore();
  invalidStore.state = {
    ...baseState(sequence),
    draftIn: Number.NaN
  };

  await invalidStore.captureOutAndSave();

  assert.equal(invalidStore.getState().captureNotice.kind, 'error');
  assert.match(invalidStore.getState().captureNotice.message, /구간/);
});

test('captureOutAndSave respects disabled automatic title inference', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', name: '저장 대상', segments: [] });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '자동 제목으로 쓰면 안 되는 영상',
      channel: '채널',
      currentTime: 45,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    settings: {
      ...baseState(sequence).settings,
      autoTitleFromCaptions: false
    },
    draftIn: 42
  };

  await store.captureOutAndSave();

  assert.equal(storage[STORAGE_KEY].sequences[0].segments[0].title, 'YouTube video_12345');
});

test('Capture OUT button previews and save button persists through the App wiring path', async () => {
  installDomShim();
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { App } = await import('../src/App.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', name: '저장 대상', segments: [] });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '멈춘 영상',
      channel: '채널',
      currentTime: 42,
      duration: 300,
      paused: true
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video_12345',
      title: '멈춘 영상',
      url: 'https://www.youtube.com/watch?v=video_12345',
      currentTime: 42,
      duration: 300
    },
    draftIn: 42
  };

  const page = App(store.getState(), store);
  const outButton = findByAriaLabel(page, 'OUT 마커 찍기');
  assert.equal(outButton.disabled, false);

  outButton.click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(storage[STORAGE_KEY].sequences[0].segments.length, 0);
  assert.equal(store.getState().draftOut, 42 + 1 / 30);

  const previewPage = App(store.getState(), store);
  findByAriaLabel(previewPage, '미리보기 구간 저장').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(storage[STORAGE_KEY].sequences[0].segments.length, 1);
  assert.equal(storage[STORAGE_KEY].sequences[0].segments[0].endSeconds, 42 + 1 / 30);
});

test('captureOutAndSave updates the visible mixtape before storage persistence finishes', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', name: '저장 대상', segments: [] });
  const storage = installChromeForCapture({
    deferSet: true,
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '느린 저장 영상',
      channel: '채널',
      currentTime: 45,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    draftIn: 42
  };

  const capture = store.captureOutAndSave();
  await new Promise((resolve) => setTimeout(resolve, 0));

  try {
    const visibleSequence = store.getState().store.sequences[0];
    assert.equal(visibleSequence.segments.length, 1);
    assert.equal(visibleSequence.segments[0].title, '느린 저장 영상');
    assert.equal(store.getState().draftIn, null);
  } finally {
    storage.releaseSet();
    await capture;
  }
});

test('captureOutAndSave restores the draft and clip stack when store persistence fails', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-failing-save', name: '저장 대상', segments: [] });
  const storage = installChromeForCapture({
    failSetKeys: [STORAGE_KEY],
    failMessage: 'quota exceeded',
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '저장 실패 영상',
      channel: '채널',
      currentTime: 45,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    draftIn: 42
  };

  await store.captureOutAndSave();

  assert.equal(store.getState().store.sequences[0].segments.length, 0);
  assert.equal(store.getState().draftIn, 42);
  assert.equal(store.getState().capturePulseId, null);
  assert.equal(store.getState().captureNotice.kind, 'error');
  assert.match(store.getState().captureNotice.message, /quota exceeded/);
  assert.equal(storage[STORAGE_KEY].sequences[0].segments.length, 0);
});

test('nudgeDraft adjusts the current IN marker and persists the draft', async () => {
  const { SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', segments: [] });
  const storage = installChromeForCapture({
    videoState: {
      videoId: 'video_12345',
      title: '테스트 영상',
      channel: '채널',
      currentTime: 42,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video_12345',
      title: '테스트 영상',
      url: 'https://www.youtube.com/watch?v=video_12345',
      currentTime: 42,
      duration: 300
    },
    draftIn: 10
  };

  await store.nudgeDraft(1 / 30);

  assert.equal(store.getState().draftIn, 10 + 1 / 30);
  assert.equal(storage[SEGMENT_DRAFT_KEY].videoId, 'video_12345');
  assert.equal(storage[SEGMENT_DRAFT_KEY].startSeconds, 10 + 1 / 30);
});

test('nudgeDraft adjusts the OUT preview when one exists', async () => {
  const { SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-nudge-out', segments: [] });
  const storage = installChromeForCapture();
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video_12345',
      title: '테스트 영상',
      url: 'https://www.youtube.com/watch?v=video_12345',
      currentTime: 42,
      duration: 300
    },
    draftIn: 10,
    draftOut: 12
  };

  await store.nudgeDraft(1 / 30);

  assert.equal(store.getState().draftIn, 10);
  assert.equal(store.getState().draftOut, 12 + 1 / 30);
  assert.equal(storage[SEGMENT_DRAFT_KEY].startSeconds, 10);
  assert.equal(storage[SEGMENT_DRAFT_KEY].endSeconds, 12 + 1 / 30);
});

test('clearCaptureDraft removes visible and persisted IN/OUT markers', async () => {
  const { SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-clear-draft', segments: [] });
  const storage = installChromeForCapture({
    storage: {
      [SEGMENT_DRAFT_KEY]: {
        videoId: 'video_12345',
        startSeconds: 10,
        endSeconds: 12,
        updatedAt: 1700000000000
      }
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video_12345',
      title: '테스트 영상',
      url: 'https://www.youtube.com/watch?v=video_12345',
      currentTime: 42,
      duration: 300
    },
    draftIn: 10,
    draftOut: 12
  };

  await store.clearCaptureDraft();

  assert.equal(store.getState().draftIn, null);
  assert.equal(store.getState().draftOut, null);
  assert.equal(storage[SEGMENT_DRAFT_KEY], undefined);
});

test('nudgeSegmentTime adjusts a saved segment range in the selected mixtape', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const segment = {
    id: 'clip-1',
    videoId: 'video_12345',
    originalUrl: 'https://www.youtube.com/watch?v=video_12345',
    title: '저장된 클립',
    startSeconds: 10,
    endSeconds: 20,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  };
  const sequence = makeSequence({ id: 'sequence-1', segments: [segment] });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '테스트 영상',
      channel: '채널',
      currentTime: 42,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  store.beginSegmentEdit('clip-1');
  await store.nudgeSegmentTime('clip-1', 'start', 1 / 30);
  await store.nudgeSegmentTime('clip-1', 'end', 1);

  const savedSegment = storage[STORAGE_KEY].sequences[0].segments[0];
  assert.equal(store.getState().segmentEdit.segmentId, 'clip-1');
  assert.equal(savedSegment.startSeconds, 10 + 1 / 30);
  assert.equal(savedSegment.endSeconds, 21);
});

test('setSegmentNote persists trimmed clip notes and removes empty notes', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const segment = {
    id: 'clip-note',
    videoId: 'video_12345',
    originalUrl: 'https://www.youtube.com/watch?v=video_12345',
    title: '노트 구간',
    startSeconds: 10,
    endSeconds: 20,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  };
  const sequence = makeSequence({ id: 'sequence-note', segments: [segment] });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  await store.setSegmentNote('clip-note', '  calm intro  ');
  assert.equal(storage[STORAGE_KEY].sequences[0].segments[0].note, 'calm intro');

  await store.setSegmentNote('clip-note', '   ');
  assert.equal(storage[STORAGE_KEY].sequences[0].segments[0].note, undefined);
});

test('nudgeSegmentTime keeps frame nudges at higher precision instead of accumulating hundredth drift', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const segment = {
    id: 'clip-precision',
    videoId: 'video_12345',
    originalUrl: 'https://www.youtube.com/watch?v=video_12345',
    title: '정밀 구간',
    startSeconds: 10,
    endSeconds: 20,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  };
  const sequence = makeSequence({ id: 'sequence-precision', segments: [segment] });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    videoState: {
      videoId: 'video_12345',
      title: '테스트 영상',
      channel: '채널',
      currentTime: 42,
      duration: 300,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  for (let index = 0; index < 30; index += 1) {
    await store.nudgeSegmentTime('clip-precision', 'start', 1 / 30);
  }

  const savedSegment = storage[STORAGE_KEY].sequences[0].segments[0];
  assert.ok(Math.abs(savedSegment.startSeconds - 11) < 1e-9);
});

test('setSegmentTimecode persists exact typed segment ranges', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-exact-range',
    segments: [{
      id: 'clip-exact-range',
      videoId: 'video_12345',
      originalUrl: 'https://www.youtube.com/watch?v=video_12345',
      title: '정확 입력 구간',
      startSeconds: 10,
      endSeconds: 20,
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    }]
  });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  store.beginSegmentEdit('clip-exact-range');
  await store.setSegmentTimecode('clip-exact-range', 'start', '00:12.50');
  await store.setSegmentTimecode('clip-exact-range', 'end', '00:18.25');

  const savedSegment = storage[STORAGE_KEY].sequences[0].segments[0];
  assert.equal(savedSegment.startSeconds, 12.5);
  assert.equal(savedSegment.endSeconds, 18.25);
  assert.equal(store.getState().segmentEdit.segmentId, 'clip-exact-range');
});

test('setSegmentTimecode rejects invalid exact ranges without changing storage', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-invalid-range',
    segments: [{
      id: 'clip-invalid-range',
      videoId: 'video_12345',
      originalUrl: 'https://www.youtube.com/watch?v=video_12345',
      title: '잘못된 입력 구간',
      startSeconds: 10,
      endSeconds: 20,
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    }]
  });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  await store.setSegmentTimecode('clip-invalid-range', 'start', '00:21.00');
  assert.match(store.getState().captureNotice.message, /시작.*끝|끝.*시작/);

  await store.setSegmentTimecode('clip-invalid-range', 'end', 'bad');

  const savedSegment = storage[STORAGE_KEY].sequences[0].segments[0];
  assert.equal(savedSegment.startSeconds, 10);
  assert.equal(savedSegment.endSeconds, 20);
  assert.match(store.getState().captureNotice.message, /초|1:00:00\.00/);
});

test('setSegmentTimecode rolls back the visible range when persistence fails', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-range-rollback',
    segments: [{
      id: 'clip-range-rollback',
      videoId: 'video_12345',
      originalUrl: 'https://www.youtube.com/watch?v=video_12345',
      title: '롤백 구간',
      startSeconds: 10,
      endSeconds: 20,
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    }]
  });
  const storage = installChromeForCapture({
    storage: {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      }
    },
    failSetKeys: [STORAGE_KEY]
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  await store.setSegmentTimecode('clip-range-rollback', 'start', '00:12.00');

  const visibleSegment = store.getState().store.sequences[0].segments[0];
  const savedSegment = storage[STORAGE_KEY].sequences[0].segments[0];
  assert.equal(visibleSegment.startSeconds, 10);
  assert.equal(savedSegment.startSeconds, 10);
  assert.match(store.getState().captureNotice.message, /저장하지 못했습니다/);
});

test('syncActiveVideoForCapture detects the active YouTube video for the edit tab', async () => {
  const { SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', segments: [] });
  installChromeForCapture({
    storage: {
      [SEGMENT_DRAFT_KEY]: {
        videoId: 'nextVideo_123',
        startSeconds: 15.25,
        endSeconds: null,
        updatedAt: 1700000000000
      }
    },
    videoState: {
      videoId: 'nextVideo_123',
      title: '새로 감지된 영상',
      channel: '채널',
      currentTime: 88.123,
      duration: 600,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    route: 'capture',
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'oldVideo_123',
      title: '오래된 영상',
      url: 'https://www.youtube.com/watch?v=oldVideo_123',
      currentTime: 5,
      duration: 100
    },
    draftIn: 42
  };

  await store.syncActiveVideoForCapture();

  assert.equal(store.getState().pageInfo.videoId, 'nextVideo_123');
  assert.equal(store.getState().pageInfo.title, '새로 감지된 영상');
  assert.equal(store.getState().pageInfo.currentTime, 88.123);
  assert.equal(store.getState().draftIn, 15.25);
});

test('refreshVideo skips publishing state when detected video data is unchanged', async () => {
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', segments: [] });
  const videoState = {
    videoId: 'sameVideo_123',
    title: '같은 영상',
    channel: '채널',
    currentTime: 88.123,
    duration: 600,
    paused: false
  };
  installChromeForCapture({ videoState });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'sameVideo_123',
      title: '같은 영상',
      url: 'https://www.youtube.com/watch?v=video_12345',
      currentTime: 88.123,
      duration: 600
    },
    videoState
  };
  let published = 0;
  store.subscribe(() => {
    published += 1;
  });

  await store.refreshVideo();

  assert.equal(published, 1);
});

test('refreshVideo converts active tab detection failures into an edit-tab notice', async () => {
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-refresh-error', segments: [] });
  installChromeForCapture({ tabsQueryError: 'Cannot query active tab' });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    route: 'capture'
  };

  const result = await store.refreshVideo();

  assert.equal(result.error, 'Cannot query active tab');
  assert.equal(store.getState().captureNotice.kind, 'error');
  assert.match(store.getState().captureNotice.message, /Cannot query active tab/);
});

test('refreshVideo publishes fallback YouTube tab info when video time cannot be read', async () => {
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-refresh-fallback', segments: [] });
  installChromeForCapture({ videoError: 'content unavailable' });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    route: 'capture'
  };

  const result = await store.refreshVideo();

  assert.equal(result.info.videoId, 'video_12345');
  assert.equal(store.getState().pageInfo.videoId, 'video_12345');
  assert.equal(store.getState().pageInfo.title, '테스트 영상');
  assert.equal(store.getState().pageInfo.currentTime, null);
  assert.equal(store.getState().videoState, null);
  assert.equal(store.getState().captureNotice.kind, 'error');
  assert.match(store.getState().captureNotice.message, /영상 정보를 갱신할 수 없습니다/);
});

test('syncActiveVideoForCapture ignores active tab changes outside the edit tab', async () => {
  const { SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-1', segments: [] });
  installChromeForCapture({
    storage: {
      [SEGMENT_DRAFT_KEY]: {
        videoId: 'nextVideo_123',
        startSeconds: 15.25,
        endSeconds: null,
        updatedAt: 1700000000000
      }
    },
    videoState: {
      videoId: 'nextVideo_123',
      title: '새로 감지된 영상',
      channel: '채널',
      currentTime: 88.123,
      duration: 600,
      paused: false
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence),
    route: 'home',
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'oldVideo_123',
      title: '오래된 영상',
      url: 'https://www.youtube.com/watch?v=oldVideo_123',
      currentTime: 5,
      duration: 100
    },
    draftIn: 42
  };

  await store.syncActiveVideoForCapture();

  assert.equal(store.getState().pageInfo.videoId, 'oldVideo_123');
  assert.equal(store.getState().draftIn, 42);
});
