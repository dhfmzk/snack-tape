import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.mjs';

function installChrome(initial = {}) {
  const data = { ...initial };
  const activeTab = {
    id: 9,
    active: true,
    url: 'https://www.youtube.com/watch?v=video-1'
  };
  const messages = [];

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
      query: async () => [activeTab],
      get: async () => activeTab,
      create: async ({ url }) => {
        activeTab.url = url;
        return activeTab;
      },
      update: async (_tabId, patch) => {
        activeTab.url = patch.url;
        return activeTab;
      },
      sendMessage(_tabId, _message, callback) {
        messages.push(_message);
        callback({ ok: true });
      }
    },
    scripting: {
      executeScript: async () => {}
    }
  };

  data.messages = messages;
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
