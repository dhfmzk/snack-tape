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
        callback({ ok: true });
      }
    },
    scripting: {
      executeScript: async () => {}
    }
  };

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
