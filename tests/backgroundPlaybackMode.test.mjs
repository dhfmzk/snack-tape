import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.mjs';

function installChrome(initial = {}, options = {}) {
  const data = { ...initial };
  const activeTab = options.activeTab ?? {
    id: 9,
    active: true,
    url: 'https://www.youtube.com/watch?v=video-1'
  };
  const currentWindowTabs = options.currentWindowTabs ?? [activeTab];
  const messages = [];
  const createdTabs = [];
  const updatedListeners = [];

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
    runtime: {
      lastError: null,
      onMessage: { addListener() {} },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} }
    },
    commands: {
      onCommand: { addListener() {} }
    },
    sidePanel: {
      setPanelBehavior: async () => {}
    },
    storage: {
      local: area,
      session: area
    },
    tabs: {
      onUpdated: {
        addListener(listener) {
          updatedListeners.push(listener);
        },
        removeListener(listener) {
          const index = updatedListeners.indexOf(listener);
          if (index >= 0) {
            updatedListeners.splice(index, 1);
          }
        }
      },
      query: async (query = {}) => (query.active ? [activeTab] : currentWindowTabs),
      get: async (tabId) => currentWindowTabs.find((tab) => tab.id === tabId) ?? activeTab,
      create: async ({ url }) => {
        const tab = { id: options.createdTabId ?? 21, active: true, url };
        createdTabs.push(tab);
        currentWindowTabs.push(tab);
        return tab;
      },
      update: async (_tabId, patch) => {
        const tab = currentWindowTabs.find((item) => item.id === _tabId) ?? activeTab;
        tab.url = patch.url;
        if (options.autoCompleteUpdate !== false) {
          queueMicrotask(() => {
            for (const listener of [...updatedListeners]) {
              listener(_tabId, { status: 'complete' }, tab);
            }
          });
        }
        return tab;
      },
      sendMessage(_tabId, _message, callback) {
        messages.push(_message);
        const response = typeof options.sendMessageResponse === 'function'
          ? options.sendMessageResponse(_message)
          : options.sendMessageResponse;
        callback(response ?? { ok: true });
      }
    },
    scripting: {
      executeScript: async () => {}
    }
  };

  data.messages = messages;
  data.createdTabs = createdTabs;
  data.activeTab = activeTab;
  return data;
}

function settings(overrides = {}) {
  return {
    accentKey: 'peach',
    language: 'en',
    autoNext: true,
    fadeOut: true,
    shuffleByDefault: false,
    shortcutIn: 'I',
    shortcutOut: 'O',
    autoTitleFromCaptions: true,
    ...overrides
  };
}

test('background startSequence honors shuffleByDefault when no mode is supplied', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-default-mode',
    segments: [
      makeSegment({ id: 'clip-1', videoId: 'video-1' }),
      makeSegment({ id: 'clip-2', videoId: 'video-1' }),
      makeSegment({ id: 'clip-3', videoId: 'video-1' })
    ]
  });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [SETTINGS_KEY]: settings({ shuffleByDefault: true })
  });
  const { startSequence } = await import('../.tmp-tests/src/background/background.js');

  await startSequence(sequence.id, 0, undefined, 9);

  assert.equal(data[PLAYBACK_STATE_KEY].mode, 'shuffle');
  assert.equal(data[PLAYBACK_STATE_KEY].order[0], 0);
  assert.equal(data[PLAYBACK_STATE_KEY].order.length, 3);
  assert.equal(new Set(data[PLAYBACK_STATE_KEY].order).size, 3);
});

test('background passes fadeOut setting into content playback messages', async () => {
  const { STORAGE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-fade-setting',
    segments: [makeSegment({ id: 'clip-fade', videoId: 'video-1' })]
  });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [SETTINGS_KEY]: settings({ fadeOut: false })
  });
  const { startSequence } = await import('../.tmp-tests/src/background/background.js');

  await startSequence(sequence.id, 0, 'sequence', 9);

  const playMessage = data.messages.find((message) => message.type === 'PLAY_SEGMENT');
  assert.equal(playMessage.fadeOut, false);
  assert.equal(playMessage.fadeOutSeconds, 0.3);
});

test('background creates a YouTube tab instead of targeting an active non-YouTube tab', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-youtube-target',
    segments: [makeSegment({ id: 'clip-target', videoId: 'video-target' })]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [SETTINGS_KEY]: settings()
    },
    {
      activeTab: { id: 9, active: true, url: 'https://example.com/article' },
      currentWindowTabs: [{ id: 9, active: true, url: 'https://example.com/article' }],
      createdTabId: 44
    }
  );
  const { startSequence } = await import('../.tmp-tests/src/background/background.js');

  await startSequence(sequence.id, 0, 'sequence');

  assert.equal(data.createdTabs.length, 1);
  assert.match(data.createdTabs[0].url, /^https:\/\/www\.youtube\.com\/watch\?v=video-target/);
  assert.equal(data[PLAYBACK_STATE_KEY].tabId, 44);
});

test('background does not save playback state when content playback handoff fails', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-content-fail',
    segments: [makeSegment({ id: 'clip-fail', videoId: 'video-1' })]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [SETTINGS_KEY]: settings()
    },
    {
      sendMessageResponse: { ok: false, error: 'content failed' }
    }
  );
  const { startSequence } = await import('../.tmp-tests/src/background/background.js');

  await assert.rejects(() => startSequence(sequence.id, 0, 'sequence', 9), /YouTube 페이지와 연결할 수 없습니다|content failed/);

  assert.equal(data[PLAYBACK_STATE_KEY], undefined);
});

test('background records waiting playback without promoting it to playing', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-waiting',
    segments: [makeSegment({ id: 'clip-waiting', videoId: 'video-1', startSeconds: 30, endSeconds: 40 })]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [SETTINGS_KEY]: settings()
    },
    {
      sendMessageResponse: { ok: true, data: { status: 'waiting', currentTime: 30 } }
    }
  );
  const { startSequence } = await import('../.tmp-tests/src/background/background.js');

  await startSequence(sequence.id, 0, 'sequence', 9);

  assert.equal(data[PLAYBACK_STATE_KEY].status, 'waiting');
  assert.equal(data[PLAYBACK_STATE_KEY].currentSegmentId, 'clip-waiting');
});

test('background promotes waiting playback when content reports user-started playback', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const sequence = makeSequence({
    id: 'sequence-started',
    segments: [makeSegment({ id: 'clip-started', videoId: 'video-1', startSeconds: 10, endSeconds: 20 })]
  });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [PLAYBACK_STATE_KEY]: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-started',
      tabId: 9,
      status: 'waiting',
      startedAt: 1,
      playbackToken: 'token-waiting',
      mode: 'sequence',
      order: [0],
      orderSegmentIds: ['clip-started'],
      orderPosition: 0
    }
  });
  let listener = null;
  globalThis.chrome.runtime.onMessage.addListener = (nextListener) => {
    listener = nextListener;
  };
  await import('../.tmp-tests/src/background/background.js?playback-started');

  const response = await new Promise((resolve) => {
    listener({ type: 'PLAYBACK_STARTED', playbackToken: 'token-waiting', currentTime: 12 }, {}, resolve);
  });

  assert.deepEqual(response, { ok: true });
  assert.equal(data[PLAYBACK_STATE_KEY].status, 'playing');
  assert.ok(data[PLAYBACK_STATE_KEY].startedAt <= Date.now());
});

test('background stops after the current segment when autoNext is disabled', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-auto-next-off',
    segments: [
      makeSegment({ id: 'clip-1', videoId: 'video-1' }),
      makeSegment({ id: 'clip-2', videoId: 'video-1' })
    ]
  });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [SETTINGS_KEY]: settings({ autoNext: false }),
    [PLAYBACK_STATE_KEY]: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-1',
      tabId: 9,
      status: 'playing',
      startedAt: 1,
      playbackToken: 'token-1',
      mode: 'sequence',
      order: [0, 1],
      orderSegmentIds: ['clip-1', 'clip-2'],
      orderPosition: 0
    }
  });
  const { nextSegment } = await import('../.tmp-tests/src/background/background.js');

  await nextSegment('token-1');

  assert.equal(data[PLAYBACK_STATE_KEY], undefined);
  assert.equal(data.messages.filter((message) => message.type === 'PLAY_SEGMENT').length, 0);
  assert.equal(data.messages.some((message) => message.type === 'STOP_PLAYBACK'), true);
});

test('background clears playback state when the backing sequence was deleted before advancing', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [],
      selectedSequenceId: null
    },
    [SETTINGS_KEY]: settings({ autoNext: true }),
    [PLAYBACK_STATE_KEY]: {
      sequenceId: 'deleted-sequence',
      segmentIndex: 0,
      currentSegmentId: 'deleted-clip',
      tabId: 9,
      status: 'playing',
      startedAt: 1,
      playbackToken: 'deleted-token',
      mode: 'sequence',
      order: [0],
      orderSegmentIds: ['deleted-clip'],
      orderPosition: 0
    }
  });
  const { nextSegment } = await import('../.tmp-tests/src/background/background.js');

  await nextSegment('deleted-token');

  assert.equal(data[PLAYBACK_STATE_KEY], undefined);
  assert.equal(data.messages.some((message) => message.type === 'STOP_PLAYBACK'), true);
});
