import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.mjs';

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
    this.type = '';
    this.accept = '';
    this.files = [];
    this.download = '';
    this.href = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      this.dataset[name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = String(value);
    }
  }

  addEventListener(type, listener) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener({ currentTarget: this, target: this, stopPropagation() {} });
    }
  }

  change() {
    for (const listener of this.listeners.change ?? []) {
      listener({ currentTarget: this, target: this });
    }
  }
}

function installDomShim() {
  const createdInputs = [];
  const downloaded = [];

  globalThis.Node = FakeNode;
  globalThis.window = {
    confirm: () => true,
    setTimeout(callback) {
      callback();
      return 0;
    }
  };
  globalThis.URL = {
    createObjectURL() {
      return `blob:snacktape-${downloaded.length + 1}`;
    },
    revokeObjectURL() {}
  };
  globalThis.document = {
    createElement(tagName) {
      const element = new FakeElement(tagName);
      if (tagName === 'input') {
        createdInputs.push(element);
      }
      if (tagName === 'a') {
        element.click = () => downloaded.push({ href: element.href, download: element.download });
      }
      return element;
    },
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
    createTextNode: (text) => new FakeNode(String(text))
  };

  return { createdInputs, downloaded };
}

function installChrome(initial = {}) {
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

function baseSettings(overrides = {}) {
  return {
    accentKey: 'peach',
    language: 'ko',
    autoNext: true,
    fadeOut: true,
    shuffleByDefault: false,
    shortcutIn: 'Alt+I',
    shortcutOut: 'Alt+O',
    autoTitleFromCaptions: true,
    ...overrides
  };
}

function baseState(sequences, settings = baseSettings()) {
  return {
    route: 'settings',
    store: {
      sequences,
      selectedSequenceId: sequences[0]?.id ?? null
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
    captureNotice: null,
    settingsNotice: null,
    loading: false
  };
}

function textOf(node) {
  return [node.textContent, node.innerHTML, ...(node.children ?? []).map(textOf)].join('');
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

function findButtonByText(node, pattern) {
  if (node.tagName === 'BUTTON' && pattern.test(textOf(node))) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findButtonByText(child, pattern);
    if (found) {
      return found;
    }
  }

  return null;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('App Settings route persists language, accent, toggles, and default save target', async () => {
  installDomShim();
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const { App } = await import('../.tmp-tests/src/App.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSequence({ id: 'sequence-1', name: 'First Tape', segments: [] });
  const second = makeSequence({ id: 'sequence-2', name: 'Second Tape', segments: [] });
  const storage = installChrome({ [SETTINGS_KEY]: baseSettings() });
  const store = new SnackTapeAppStore();
  store.state = baseState([first, second]);
  const page = App(store.getState(), store);

  const language = findByAriaLabel(page, '언어');
  language.value = 'ja';
  language.change();
  await settle();

  findByAriaLabel(page, 'Sky Glow 선택').click();
  await settle();

  findByAriaLabel(page, '자동 다음 재생 끄기').click();
  await settle();
  findByAriaLabel(page, '구간 끝에서 0.3초 페이드 끄기').click();
  await settle();
  findByAriaLabel(page, '기본 시작 시 셔플 켜기').click();
  await settle();
  findByAriaLabel(page, 'OUT 시 자동 제목 추론 끄기').click();
  await settle();

  const defaultTarget = findByAriaLabel(page, '기본 저장 위치 선택');
  defaultTarget.value = second.id;
  defaultTarget.change();
  await settle();

  assert.equal(store.getState().settings.language, 'ja');
  assert.equal(store.getState().settings.accentKey, 'sky');
  assert.equal(store.getState().settings.autoNext, false);
  assert.equal(store.getState().settings.fadeOut, false);
  assert.equal(store.getState().settings.shuffleByDefault, true);
  assert.equal(store.getState().settings.autoTitleFromCaptions, false);
  assert.equal(store.getState().settings.defaultMixtapeId, second.id);
  assert.deepEqual(storage[SETTINGS_KEY], store.getState().settings);
});

test('App Settings route wires export, import, and delete-all data actions', async () => {
  const dom = installDomShim();
  const { STORAGE_KEY, PLAYBACK_STATE_KEY, SEGMENT_DRAFT_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const { serializeStoreJson } = await import('../.tmp-tests/src/shared/dataTransfer.js');
  const { App } = await import('../.tmp-tests/src/App.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const current = makeSequence({
    id: 'sequence-current',
    name: 'Current Tape',
    segments: [makeSegment({ id: 'clip-current' })]
  });
  const imported = makeSequence({
    id: 'sequence-imported',
    name: 'Imported Tape',
    segments: [makeSegment({ id: 'clip-imported' })]
  });
  const storage = installChrome({
    [STORAGE_KEY]: {
      sequences: [current],
      selectedSequenceId: current.id
    },
    [SETTINGS_KEY]: baseSettings({ defaultMixtapeId: current.id }),
    [PLAYBACK_STATE_KEY]: { sequenceId: current.id, segmentIndex: 0, status: 'playing', startedAt: 1 },
    [SEGMENT_DRAFT_KEY]: { videoId: 'video-1', startSeconds: 1, endSeconds: null, updatedAt: 1 }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState([current], baseSettings({ defaultMixtapeId: current.id }));
  const page = App(store.getState(), store);

  findButtonByText(page, /^JSON$/).click();
  findButtonByText(page, /^CSV$/).click();
  await settle();

  assert.match(dom.downloaded[0].download, /^snacktape-export-.*\.json$/);
  assert.match(dom.downloaded[1].download, /^snacktape-export-.*\.csv$/);

  findButtonByText(page, /가져오기/).click();
  assert.equal(dom.createdInputs.length, 1);
  dom.createdInputs[0].files = [{
    text: async () => serializeStoreJson({
      sequences: [imported],
      selectedSequenceId: imported.id
    })
  }];
  dom.createdInputs[0].change();
  await settle();

  assert.equal(store.getState().store.sequences[0].id, imported.id);
  assert.equal(storage[STORAGE_KEY].sequences[0].id, imported.id);
  assert.equal(storage[SETTINGS_KEY].defaultMixtapeId, undefined);

  findButtonByText(App(store.getState(), store), /모든 클립 삭제/).click();
  await settle();

  assert.deepEqual(store.getState().store.sequences, []);
  assert.deepEqual(storage[STORAGE_KEY].sequences, []);
  assert.equal(storage[PLAYBACK_STATE_KEY], undefined);
  assert.equal(storage[SEGMENT_DRAFT_KEY], undefined);
});

test('App Settings route leaves data intact when delete-all confirmation is cancelled', async () => {
  installDomShim();
  window.confirm = () => false;
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const { App } = await import('../.tmp-tests/src/App.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-keep',
    name: 'Keep Tape',
    segments: [makeSegment({ id: 'clip-keep' })]
  });
  const storage = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [SETTINGS_KEY]: baseSettings({ defaultMixtapeId: sequence.id })
  });
  const store = new SnackTapeAppStore();
  store.state = baseState([sequence], baseSettings({ defaultMixtapeId: sequence.id }));

  findButtonByText(App(store.getState(), store), /모든 클립 삭제/).click();
  await settle();

  assert.equal(store.getState().store.sequences[0].id, sequence.id);
  assert.equal(storage[STORAGE_KEY].sequences[0].id, sequence.id);
});

test('App exports a JSON backup before deleting a mixtape when requested', async () => {
  const dom = installDomShim();
  const confirmMessages = [];
  window.confirm = (message) => {
    confirmMessages.push(message);
    return true;
  };
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { App } = await import('../.tmp-tests/src/App.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const first = makeSequence({
    id: 'sequence-delete',
    name: 'Delete Tape',
    segments: [makeSegment({ id: 'clip-delete' })]
  });
  const second = makeSequence({
    id: 'sequence-keep',
    name: 'Keep Tape',
    segments: [makeSegment({ id: 'clip-keep' })]
  });
  const storage = installChrome({
    [STORAGE_KEY]: {
      sequences: [first, second],
      selectedSequenceId: first.id
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState([first, second]),
    route: 'home'
  };

  findByAriaLabel(App(store.getState(), store), 'Delete Tape 삭제').click();
  await settle();

  assert.match(confirmMessages[0], /JSON.*백업/);
  assert.match(confirmMessages[1], /Delete Tape/);
  assert.match(dom.downloaded[0].download, /^snacktape-export-.*\.json$/);
  assert.deepEqual(storage[STORAGE_KEY].sequences.map((sequence) => sequence.id), [second.id]);
});

test('App asks before deleting a single saved segment', async () => {
  installDomShim();
  const confirmMessages = [];
  window.confirm = (message) => {
    confirmMessages.push(message);
    return false;
  };
  const { App } = await import('../.tmp-tests/src/App.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-segment-confirm',
    name: 'Segment Tape',
    segments: [makeSegment({ id: 'clip-confirm', title: 'Clip To Keep' })]
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState([sequence]),
    route: 'capture'
  };

  findByAriaLabel(App(store.getState(), store), 'Clip To Keep 삭제').click();
  await settle();

  assert.match(confirmMessages[0], /Clip To Keep/);
  assert.equal(store.getState().store.sequences[0].segments.length, 1);
});

test('App wires clip note editing from the capture route', async () => {
  installDomShim();
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { App } = await import('../.tmp-tests/src/App.js');
  const { SnackTapeAppStore } = await import('../.tmp-tests/src/state/store.js');
  const sequence = makeSequence({
    id: 'sequence-note',
    name: 'Note Tape',
    segments: [makeSegment({ id: 'clip-note', title: 'Clip Note', note: 'old note' })]
  });
  const storage = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState([sequence]),
    route: 'capture',
    segmentEdit: { segmentId: 'clip-note' }
  };

  const note = findByAriaLabel(App(store.getState(), store), 'Clip Note 메모');
  note.value = 'new note';
  note.change();
  await settle();

  assert.equal(storage[STORAGE_KEY].sequences[0].segments[0].note, 'new note');
});
