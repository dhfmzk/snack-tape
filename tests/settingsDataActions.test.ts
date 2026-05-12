// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.js';

function installChrome(initial = {}, options = {}) {
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
    runtime: { lastError: null },
    storage: {
      local: area,
      session: area
    }
  };

  return data;
}

function installDownloadDom() {
  const clicks = [];
  const urls = [];
  globalThis.window = {
    setTimeout(callback) {
      callback();
      return 0;
    }
  };
  globalThis.URL = {
    createObjectURL(blob) {
      urls.push(blob);
      return `blob:snacktape-${urls.length}`;
    },
    revokeObjectURL() {}
  };
  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, 'a');
      return {
        href: '',
        download: '',
        click() {
          clicks.push({ href: this.href, download: this.download });
        }
      };
    }
  };

  return { clicks, urls };
}

function installClipboard() {
  const writes = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (text) => writes.push(text)
      }
    }
  });
  return writes;
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

function baseState(sequence, settings = baseSettings()) {
  return {
    route: 'settings',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
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
    pendingImport: null,
    loading: false
  };
}

test('setDefaultMixtape persists an existing mixtape as the default save target', async () => {
  const { SETTINGS_KEY } = await import('../src/state/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const first = makeSequence({ id: 'sequence-1', segments: [] });
  const second = makeSequence({ id: 'sequence-2', segments: [] });
  const data = installChrome();
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(first),
    store: {
      sequences: [first, second],
      selectedSequenceId: first.id
    }
  };

  await store.setDefaultMixtape(second.id);

  assert.equal(store.getState().settings.defaultMixtapeId, second.id);
  assert.equal(data[SETTINGS_KEY].defaultMixtapeId, second.id);
});

test('updateSettings restores previous settings when persistence fails', async () => {
  const { SETTINGS_KEY } = await import('../src/state/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-settings-fail', segments: [] });
  const previousSettings = baseSettings({ accentKey: 'peach', language: 'ko' });
  const data = installChrome({
    [SETTINGS_KEY]: previousSettings
  }, {
    failSetKeys: [SETTINGS_KEY],
    failMessage: 'quota exceeded'
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence, previousSettings);

  await store.updateSettings({ accentKey: 'sky', language: 'en' });

  assert.equal(store.getState().settings.accentKey, 'peach');
  assert.equal(store.getState().settings.language, 'ko');
  assert.equal(data[SETTINGS_KEY].accentKey, 'peach');
  assert.equal(store.getState().settingsNotice.kind, 'error');
  assert.match(store.getState().settingsNotice.message, /quota exceeded/);
});

test('exportData downloads JSON and CSV backups from the current store', async () => {
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-export', name: 'Export Tape', segments: [makeSegment({ id: 'clip-export' })] });
  installChrome();
  const dom = installDownloadDom();
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  await store.exportData('json');
  await store.exportData('csv');

  assert.match(dom.clicks[0].download, /^snacktape-export-.*\.json$/);
  assert.match(dom.clicks[1].download, /^snacktape-export-.*\.csv$/);
  assert.equal(store.getState().settingsNotice.kind, 'info');
});

test('importDataFile previews before replace and clears stale default save targets on apply', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY, SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../src/state/storage.js');
  const { serializeStoreJson } = await import('../src/shared/dataTransfer.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const oldSequence = makeSequence({ id: 'old-sequence', segments: [makeSegment({ id: 'old-clip' })] });
  const newSequence = makeSequence({ id: 'new-sequence', segments: [makeSegment({ id: 'new-clip' })] });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [oldSequence],
      selectedSequenceId: oldSequence.id
    },
    [PLAYBACK_STATE_KEY]: { sequenceId: oldSequence.id, segmentIndex: 0, status: 'playing', startedAt: 1 },
    [SEGMENT_DRAFT_KEY]: { videoId: 'video-1', startSeconds: 1, endSeconds: null, updatedAt: 1 },
    [SETTINGS_KEY]: baseSettings({ defaultMixtapeId: oldSequence.id })
  });
  const dom = installDownloadDom();
  const store = new SnackTapeAppStore();
  store.state = baseState(oldSequence, baseSettings({ defaultMixtapeId: oldSequence.id }));

  await store.importDataFile({
    text: async () => serializeStoreJson({
      sequences: [newSequence],
      selectedSequenceId: newSequence.id
    })
  });

  assert.equal(store.getState().store.sequences[0].id, oldSequence.id);
  assert.equal(data[STORAGE_KEY].sequences[0].id, oldSequence.id);
  assert.equal(store.getState().pendingImport.store.sequences[0].id, newSequence.id);
  assert.equal(store.getState().pendingImport.summary.mixtapeCount, 1);
  assert.equal(store.getState().pendingImport.summary.clipCount, 1);
  assert.equal(store.getState().settingsNotice.kind, 'info');

  await store.replaceWithPendingImport();

  assert.equal(dom.clicks.length, 1);
  assert.match(dom.clicks[0].download, /^snacktape-pre-import-backup-.*\.json$/);
  assert.equal(store.getState().store.sequences[0].id, newSequence.id);
  assert.equal(store.getState().settings.defaultMixtapeId, undefined);
  assert.equal(store.getState().pendingImport, null);
  assert.equal(data[STORAGE_KEY].sequences[0].id, newSequence.id);
  assert.equal(data[PLAYBACK_STATE_KEY], undefined);
  assert.equal(data[SEGMENT_DRAFT_KEY], undefined);
  assert.equal(data[SETTINGS_KEY].defaultMixtapeId, undefined);
  assert.equal(store.getState().settingsNotice.kind, 'info');
});

test('mergePendingImport appends imported mixtapes without replacing the current library', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { serializeStoreJson } = await import('../src/shared/dataTransfer.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const current = makeSequence({
    id: 'sequence-current',
    name: 'Sleep Tape',
    segments: [makeSegment({ id: 'clip-current', videoId: 'current-video', startSeconds: 1, endSeconds: 2 })]
  });
  const imported = makeSequence({
    id: 'sequence-current',
    name: 'Sleep Tape',
    segments: [makeSegment({ id: 'clip-current', videoId: 'imported-video', startSeconds: 3, endSeconds: 4 })]
  });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [current],
      selectedSequenceId: current.id
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(current);

  await store.importDataFile({
    text: async () => serializeStoreJson({
      sequences: [imported],
      selectedSequenceId: imported.id
    })
  });
  await store.mergePendingImport();

  const nextStore = store.getState().store;
  assert.equal(nextStore.sequences.length, 2);
  assert.equal(nextStore.sequences[0].id, current.id);
  assert.notEqual(nextStore.sequences[1].id, current.id);
  assert.equal(nextStore.sequences[1].name, 'Sleep Tape Imported');
  assert.equal(nextStore.sequences[0].segments[0].id, 'clip-current');
  assert.notEqual(nextStore.sequences[1].segments[0].id, 'clip-current');
  assert.equal(store.getState().pendingImport, null);
  assert.equal(data[STORAGE_KEY].sequences.length, 2);
});

test('cancelImportPreview clears pending import without touching stored data', async () => {
  const { STORAGE_KEY } = await import('../src/shared/storage.js');
  const { serializeStoreJson } = await import('../src/shared/dataTransfer.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const current = makeSequence({ id: 'sequence-current', segments: [makeSegment({ id: 'clip-current' })] });
  const imported = makeSequence({ id: 'sequence-imported', segments: [makeSegment({ id: 'clip-imported' })] });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [current],
      selectedSequenceId: current.id
    }
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(current);

  await store.importDataFile({
    text: async () => serializeStoreJson({
      sequences: [imported],
      selectedSequenceId: imported.id
    })
  });
  store.cancelImportPreview();

  assert.equal(store.getState().pendingImport, null);
  assert.equal(store.getState().store.sequences[0].id, current.id);
  assert.equal(data[STORAGE_KEY].sequences[0].id, current.id);
});

test('resetSettings restores defaults without clearing user data', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY, SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SETTINGS_KEY, DEFAULT_SETTINGS } = await import('../src/state/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-reset', segments: [makeSegment({ id: 'clip-reset' })] });
  const customSettings = baseSettings({
    accentKey: 'sky',
    language: 'en',
    autoNext: false,
    fadeOut: false,
    shuffleByDefault: true,
    defaultMixtapeId: sequence.id,
    autoTitleFromCaptions: false
  });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [PLAYBACK_STATE_KEY]: { sequenceId: sequence.id, segmentIndex: 0, status: 'paused', startedAt: 1 },
    [SEGMENT_DRAFT_KEY]: { videoId: 'video-1', startSeconds: 1, endSeconds: null, updatedAt: 1 },
    [SETTINGS_KEY]: customSettings
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence, customSettings);

  await store.resetSettings();

  assert.deepEqual(store.getState().settings, DEFAULT_SETTINGS);
  assert.deepEqual(data[SETTINGS_KEY], DEFAULT_SETTINGS);
  assert.equal(store.getState().store.sequences[0].id, sequence.id);
  assert.equal(data[STORAGE_KEY].sequences[0].id, sequence.id);
  assert.equal(data[PLAYBACK_STATE_KEY].sequenceId, sequence.id);
  assert.equal(data[SEGMENT_DRAFT_KEY].videoId, 'video-1');
  assert.equal(store.getState().settingsNotice.kind, 'info');
});

test('copyDiagnostics copies a summarized support snapshot without clip source details', async () => {
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const segment = makeSegment({
    id: 'clip-secret',
    title: 'Private Clip Title',
    originalUrl: 'https://www.youtube.com/watch?v=secret-video',
    note: 'private note'
  });
  const sequence = makeSequence({ id: 'sequence-diagnostics', name: 'Support Tape', segments: [segment] });
  const writes = installClipboard();
  installChrome();
  const store = new SnackTapeAppStore();
  store.state = {
    ...baseState(sequence, baseSettings({ language: 'en', accentKey: 'sky' })),
    route: 'settings',
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'secret-video',
      title: 'Private Page Title',
      url: 'https://www.youtube.com/watch?v=secret-video',
      currentTime: 12,
      duration: 120
    },
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: segment.id,
      tabId: 42,
      status: 'playing',
      startedAt: 1,
      mode: 'shuffle',
      orderSegmentIds: [segment.id],
      queueEdited: true
    }
  };

  await store.copyDiagnostics();

  assert.equal(writes.length, 1);
  const snapshot = JSON.parse(writes[0]);
  assert.equal(snapshot.app.route, 'settings');
  assert.equal(snapshot.app.language, 'en');
  assert.equal(snapshot.app.accentKey, 'sky');
  assert.equal(snapshot.store.mixtapeCount, 1);
  assert.equal(snapshot.store.clipCount, 1);
  assert.equal(snapshot.store.selectedMixtape.name, 'Support Tape');
  assert.equal(snapshot.playback.status, 'playing');
  assert.equal(snapshot.playback.tabId, 42);
  assert.equal(snapshot.activeVideo.videoId, 'secret-video');
  assert.equal(snapshot.activeVideo.hasTitle, true);
  assert.equal(store.getState().settingsNotice.message, 'Diagnostics copied to clipboard.');
  assert.doesNotMatch(writes[0], /Private Clip Title/);
  assert.doesNotMatch(writes[0], /Private Page Title/);
  assert.doesNotMatch(writes[0], /private note/);
  assert.doesNotMatch(writes[0], /watch\?v=secret-video/);
});

test('importDataFile reports invalid JSON and clears a stale pending preview', async () => {
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-invalid-import', segments: [] });
  const imported = makeSequence({ id: 'sequence-stale-preview', name: 'Stale Preview', segments: [] });
  installChrome();
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence);

  await store.importDataFile({
    text: async () => JSON.stringify({ app: 'SnackTape', version: 1, exportedAt: '2026-05-12T00:00:00.000Z', store: { sequences: [imported], selectedSequenceId: imported.id } })
  });
  assert.equal(store.getState().pendingImport.store.sequences[0].id, imported.id);

  await store.importDataFile({ text: async () => '{ nope' });

  assert.equal(store.getState().store.sequences[0].id, sequence.id);
  assert.equal(store.getState().pendingImport, null);
  assert.equal(store.getState().settingsNotice.kind, 'error');
});

test('deleteAllData clears mixtapes, playback, drafts, and stale default target', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY, SEGMENT_DRAFT_KEY } = await import('../src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../src/state/storage.js');
  const { SnackTapeAppStore } = await import('../src/state/store.js');
  const sequence = makeSequence({ id: 'sequence-delete-all', segments: [makeSegment({ id: 'clip-delete-all' })] });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [PLAYBACK_STATE_KEY]: { sequenceId: sequence.id, segmentIndex: 0, status: 'playing', startedAt: 1 },
    [SEGMENT_DRAFT_KEY]: { videoId: 'video-1', startSeconds: 1, endSeconds: null, updatedAt: 1 },
    [SETTINGS_KEY]: baseSettings({ defaultMixtapeId: sequence.id })
  });
  const store = new SnackTapeAppStore();
  store.state = baseState(sequence, baseSettings({ defaultMixtapeId: sequence.id }));

  await store.deleteAllData();

  assert.deepEqual(store.getState().store.sequences, []);
  assert.equal(store.getState().store.selectedSequenceId, null);
  assert.deepEqual(data[STORAGE_KEY].sequences, []);
  assert.equal(data[PLAYBACK_STATE_KEY], undefined);
  assert.equal(data[SEGMENT_DRAFT_KEY], undefined);
  assert.equal(data[SETTINGS_KEY].defaultMixtapeId, undefined);
  assert.equal(store.getState().settingsNotice.kind, 'info');
});
