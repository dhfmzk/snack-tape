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
  const runtimeMessages = [];
  const createdTabs = [];
  const updatedListeners = [];
  const commandListeners = [];

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
      sendMessage(message, callback) {
        runtimeMessages.push(message);
        if (options.runtimeSendMessageError) {
          globalThis.chrome.runtime.lastError = { message: options.runtimeSendMessageError };
          callback?.();
          globalThis.chrome.runtime.lastError = null;
          return;
        }
        callback?.(options.runtimeSendMessageResponse);
      },
      onMessage: { addListener() {} },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} }
    },
    commands: {
      onCommand: {
        addListener(listener) {
          commandListeners.push(listener);
        }
      }
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
  data.runtimeMessages = runtimeMessages;
  data.createdTabs = createdTabs;
  data.commandListeners = commandListeners;
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

test('background startSequence preserves repeat mode for the current clip', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-repeat-mode',
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
    [SETTINGS_KEY]: settings()
  });
  const { startSequence } = await import('../.tmp-tests/src/background/background.js?repeat-mode-start');

  await startSequence(sequence.id, 1, 'repeat', 9);

  assert.equal(data[PLAYBACK_STATE_KEY].mode, 'repeat');
  assert.deepEqual(data[PLAYBACK_STATE_KEY].order, [1]);
  assert.deepEqual(data[PLAYBACK_STATE_KEY].orderSegmentIds, ['clip-2']);
  assert.equal(data[PLAYBACK_STATE_KEY].orderPosition, 0);
});

test('background startSequence uses an explicit session queue order when provided', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const sequence = makeSequence({
    id: 'sequence-explicit-queue',
    segments: [
      makeSegment({ id: 'clip-a', videoId: 'video-1' }),
      makeSegment({ id: 'clip-b', videoId: 'video-1' }),
      makeSegment({ id: 'clip-c', videoId: 'video-1' })
    ]
  });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });
  const { startSequence } = await import('../.tmp-tests/src/background/background.js?explicit-session-queue');

  await startSequence(sequence.id, 2, 'sequence', 9, ['clip-c', 'clip-a'], true);

  assert.equal(data[PLAYBACK_STATE_KEY].currentSegmentId, 'clip-c');
  assert.deepEqual(data[PLAYBACK_STATE_KEY].order, [2, 0]);
  assert.deepEqual(data[PLAYBACK_STATE_KEY].orderSegmentIds, ['clip-c', 'clip-a']);
  assert.equal(data[PLAYBACK_STATE_KEY].queueEdited, true);
  assert.equal(data[PLAYBACK_STATE_KEY].orderPosition, 0);
});

test('background startSequence records last played segment metadata on the mixtape', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const sequence = makeSequence({
    id: 'sequence-last-played',
    segments: [
      makeSegment({ id: 'clip-1', videoId: 'video-1' }),
      makeSegment({ id: 'clip-2', videoId: 'video-1' })
    ]
  });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    }
  });
  const { startSequence } = await import('../.tmp-tests/src/background/background.js?record-last-played');

  await startSequence(sequence.id, 1, 'sequence', 9);

  assert.equal(data[PLAYBACK_STATE_KEY].currentSegmentId, 'clip-2');
  assert.equal(data[STORAGE_KEY].sequences[0].lastPlayedSegmentId, 'clip-2');
  assert.equal(typeof data[STORAGE_KEY].sequences[0].lastPlayedAt, 'number');
});

test('background repeats the current clip when a repeat-mode segment ends', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-repeat-advance',
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
    [SETTINGS_KEY]: settings({ autoNext: true }),
    [PLAYBACK_STATE_KEY]: {
      sequenceId: sequence.id,
      segmentIndex: 1,
      currentSegmentId: 'clip-2',
      tabId: 9,
      status: 'playing',
      startedAt: 1,
      playbackToken: 'token-repeat',
      mode: 'repeat',
      order: [1],
      orderSegmentIds: ['clip-2'],
      orderPosition: 0
    }
  });
  const { nextSegment } = await import('../.tmp-tests/src/background/background.js?repeat-mode-next');

  await nextSegment('token-repeat');

  assert.equal(data[PLAYBACK_STATE_KEY].currentSegmentId, 'clip-2');
  assert.equal(data[PLAYBACK_STATE_KEY].segmentIndex, 1);
  assert.equal(data.messages.filter((message) => message.type === 'PLAY_SEGMENT').length, 1);
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

test('background seekPlayback clamps to the active segment and forwards seek to YouTube', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const sequence = makeSequence({
    id: 'sequence-seek-command',
    segments: [makeSegment({ id: 'clip-seek-command', videoId: 'video-1', startSeconds: 10, endSeconds: 20 })]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [PLAYBACK_STATE_KEY]: {
        sequenceId: sequence.id,
        segmentIndex: 0,
        currentSegmentId: 'clip-seek-command',
        tabId: 9,
        status: 'playing',
        startedAt: 1,
        playbackToken: 'token-seek-command',
        mode: 'sequence',
        order: [0],
        orderSegmentIds: ['clip-seek-command'],
        orderPosition: 0
      }
    },
    {
      sendMessageResponse(message) {
        if (message.type === 'GET_PAGE_INFO') {
          return { ok: true, data: { isYouTubeVideoPage: true, videoId: 'video-1', title: 'Video 1', url: 'https://www.youtube.com/watch?v=video-1', currentTime: 12, duration: 120 } };
        }
        return { ok: true };
      }
    }
  );
  const { seekPlayback } = await import('../.tmp-tests/src/background/background.js?seek-playback');

  await seekPlayback(25);

  assert.deepEqual(data.messages.at(-1), { type: 'seek', sec: 20 });
  assert.equal(data[PLAYBACK_STATE_KEY].status, 'playing');
  assert.ok(data.runtimeMessages.some((message) => message.type === 'PLAYBACK_STATE_CHANGED'));
});

test('background seekPlayback rejects controls when the stored tab moved to another video', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-seek-mismatch',
    segments: [makeSegment({ id: 'clip-seek-mismatch', videoId: 'video-1', startSeconds: 10, endSeconds: 20 })]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [SETTINGS_KEY]: settings({ language: 'en' }),
      [PLAYBACK_STATE_KEY]: {
        sequenceId: sequence.id,
        segmentIndex: 0,
        currentSegmentId: 'clip-seek-mismatch',
        tabId: 9,
        status: 'playing',
        startedAt: 1,
        playbackToken: 'token-seek-mismatch',
        mode: 'sequence',
        order: [0],
        orderSegmentIds: ['clip-seek-mismatch'],
        orderPosition: 0
      }
    },
    {
      sendMessageResponse(message) {
        if (message.type === 'GET_PAGE_INFO') {
          return { ok: true, data: { isYouTubeVideoPage: true, videoId: 'other-video', title: 'Other', url: 'https://www.youtube.com/watch?v=other-video', currentTime: 12, duration: 120 } };
        }
        return { ok: true };
      }
    }
  );
  const { seekPlayback } = await import('../.tmp-tests/src/background/background.js?seek-playback-mismatch');

  await assert.rejects(() => seekPlayback(15), /Cannot connect to the YouTube tab/);

  assert.deepEqual(data.messages.map((message) => message.type), ['GET_PAGE_INFO']);
  assert.equal(data[PLAYBACK_STATE_KEY].currentTime, undefined);
});

test('background pausePlayback pauses YouTube and stores the paused segment position', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const sequence = makeSequence({
    id: 'sequence-pause-command',
    segments: [makeSegment({ id: 'clip-pause-command', videoId: 'video-1', startSeconds: 10, endSeconds: 20 })]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [PLAYBACK_STATE_KEY]: {
        sequenceId: sequence.id,
        segmentIndex: 0,
        currentSegmentId: 'clip-pause-command',
        tabId: 9,
        status: 'playing',
        startedAt: 1,
        playbackToken: 'token-pause-command',
        mode: 'sequence',
        order: [0],
        orderSegmentIds: ['clip-pause-command'],
        orderPosition: 0
      }
    },
    {
      sendMessageResponse(message) {
        if (message.type === 'GET_PAGE_INFO') {
          return { ok: true, data: { isYouTubeVideoPage: true, videoId: 'video-1', title: 'Video 1', url: 'https://www.youtube.com/watch?v=video-1', currentTime: 14, duration: 120 } };
        }
        return { ok: true };
      }
    }
  );
  const { pausePlayback } = await import('../.tmp-tests/src/background/background.js?pause-playback');

  await pausePlayback();

  assert.deepEqual(data.messages.map((message) => message.type), ['GET_PAGE_INFO', 'pause']);
  assert.equal(data[PLAYBACK_STATE_KEY].status, 'paused');
  assert.ok(data[PLAYBACK_STATE_KEY].startedAt <= Date.now());
  assert.ok(data.runtimeMessages.some((message) => message.type === 'PLAYBACK_STATE_CHANGED'));
});

test('background resumePlayback resumes YouTube from the stored paused position', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const sequence = makeSequence({
    id: 'sequence-resume-command',
    segments: [makeSegment({ id: 'clip-resume-command', videoId: 'video-1', startSeconds: 10, endSeconds: 20 })]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [PLAYBACK_STATE_KEY]: {
        sequenceId: sequence.id,
        segmentIndex: 0,
        currentSegmentId: 'clip-resume-command',
        tabId: 9,
        status: 'paused',
        startedAt: Date.now() - 4000,
        playbackToken: 'token-resume-command',
        mode: 'sequence',
        order: [0],
        orderSegmentIds: ['clip-resume-command'],
        orderPosition: 0
      }
    },
    {
      sendMessageResponse(message) {
        if (message.type === 'GET_PAGE_INFO') {
          return { ok: true, data: { isYouTubeVideoPage: true, videoId: 'video-1', title: 'Video 1', url: 'https://www.youtube.com/watch?v=video-1', currentTime: 14, duration: 120 } };
        }
        if (message.type === 'play') {
          return { ok: true, data: { status: 'playing', currentTime: 14 } };
        }
        return { ok: true };
      }
    }
  );
  const { resumePlayback } = await import('../.tmp-tests/src/background/background.js?resume-playback');

  await resumePlayback();

  assert.deepEqual(data.messages.map((message) => message.type), ['GET_PAGE_INFO', 'play']);
  assert.equal(data[PLAYBACK_STATE_KEY].status, 'playing');
  assert.ok(data.runtimeMessages.some((message) => message.type === 'PLAYBACK_STATE_CHANGED'));
});

test('background resumePlayback keeps waiting status when content cannot resume immediately', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-resume-waiting',
    segments: [makeSegment({ id: 'clip-resume-waiting', videoId: 'video-1', startSeconds: 10, endSeconds: 20 })]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [SETTINGS_KEY]: settings({ language: 'en', accentKey: 'sky' }),
      [PLAYBACK_STATE_KEY]: {
        sequenceId: sequence.id,
        segmentIndex: 0,
        currentSegmentId: 'clip-resume-waiting',
        tabId: 9,
        status: 'paused',
        startedAt: Date.now() - 4000,
        playbackToken: 'token-resume-waiting',
        mode: 'sequence',
        order: [0],
        orderSegmentIds: ['clip-resume-waiting'],
        orderPosition: 0
      }
    },
    {
      sendMessageResponse(message) {
        if (message.type === 'GET_PAGE_INFO') {
          return { ok: true, data: { isYouTubeVideoPage: true, videoId: 'video-1', title: 'Video 1', url: 'https://www.youtube.com/watch?v=video-1', currentTime: 14, duration: 120 } };
        }
        if (message.type === 'play') {
          return { ok: true, data: { status: 'waiting', currentTime: 14 } };
        }
        return { ok: true };
      }
    }
  );
  const { resumePlayback } = await import('../.tmp-tests/src/background/background.js?resume-playback-waiting');

  await resumePlayback();

  assert.deepEqual(data.messages.at(-1), { type: 'play', language: 'en', accentKey: 'sky' });
  assert.equal(data[PLAYBACK_STATE_KEY].status, 'waiting');
  assert.equal(data[PLAYBACK_STATE_KEY].currentTime, 14);
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

test('background notifies extension views after automatic segment advance changes playback state', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-auto-advance',
    segments: [
      makeSegment({ id: 'clip-1', videoId: 'video-1', startSeconds: 10, endSeconds: 20 }),
      makeSegment({ id: 'clip-2', videoId: 'video-1', startSeconds: 30, endSeconds: 40 })
    ]
  });
  const data = installChrome({
    [STORAGE_KEY]: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
    },
    [SETTINGS_KEY]: settings({ autoNext: true }),
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
  const { nextSegment } = await import('../.tmp-tests/src/background/background.js?auto-advance-notify');

  await nextSegment('token-1');

  assert.equal(data[PLAYBACK_STATE_KEY].currentSegmentId, 'clip-2');
  assert.equal(data.runtimeMessages.some((message) => message.type === 'PLAYBACK_STATE_CHANGED'), true);
});

test('background capture command saves IN when the side panel is not receiving commands', async () => {
  const { SEGMENT_DRAFT_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const data = installChrome(
    {},
    {
      runtimeSendMessageError: 'Could not establish connection. Receiving end does not exist.',
      sendMessageResponse(message) {
        if (message.type === 'getVideoState') {
          return {
            ok: true,
            data: {
              videoId: 'video-1',
              title: 'Command Video',
              channel: 'Channel',
              currentTime: 12.5,
              duration: 90,
              paused: false
            }
          };
        }
        return { ok: true };
      }
    }
  );
  await import('../.tmp-tests/src/background/background.js?command-capture-in');

  data.commandListeners[0]('capture-in');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(data.runtimeMessages[0].type, 'COMMAND_EVENT');
  assert.equal(data[SEGMENT_DRAFT_KEY].videoId, 'video-1');
  assert.equal(data[SEGMENT_DRAFT_KEY].startSeconds, 12.5);
});

test('background capture command saves OUT into the selected mixtape when the side panel is closed', async () => {
  const { STORAGE_KEY, SEGMENT_DRAFT_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const sequence = makeSequence({ id: 'sequence-command-capture', segments: [] });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [SEGMENT_DRAFT_KEY]: {
        videoId: 'video-1',
        startSeconds: 12,
        endSeconds: null,
        updatedAt: 1
      }
    },
    {
      runtimeSendMessageError: 'Could not establish connection. Receiving end does not exist.',
      sendMessageResponse(message) {
        if (message.type === 'getVideoState') {
          return {
            ok: true,
            data: {
              videoId: 'video-1',
              title: 'Command Video',
              channel: 'Channel',
              currentTime: 15,
              duration: 90,
              paused: false
            }
          };
        }
        return { ok: true };
      }
    }
  );
  await import('../.tmp-tests/src/background/background.js?command-capture-out');

  data.commandListeners[0]('capture-out');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(data[STORAGE_KEY].sequences[0].segments.length, 1);
  assert.equal(data[STORAGE_KEY].sequences[0].segments[0].title, 'Command Video');
  assert.equal(data[STORAGE_KEY].sequences[0].segments[0].startSeconds, 12);
  assert.equal(data[STORAGE_KEY].sequences[0].segments[0].endSeconds, 15);
  assert.equal(data[SEGMENT_DRAFT_KEY], undefined);
});

test('background play-pause command starts the selected mixtape when the side panel is closed', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-command-play',
    segments: [makeSegment({ id: 'clip-command-play', videoId: 'video-1' })]
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
      runtimeSendMessageError: 'Could not establish connection. Receiving end does not exist.',
      sendMessageResponse(message) {
        if (message.type === 'GET_PAGE_INFO') {
          return { ok: true, data: { isYouTubeVideoPage: true, videoId: 'video-1', title: 'Video 1', url: 'https://www.youtube.com/watch?v=video-1', currentTime: 12, duration: 120 } };
        }
        return { ok: true };
      }
    }
  );
  await import('../.tmp-tests/src/background/background.js?command-play-pause-start');

  data.commandListeners[0]('play-pause');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(data.runtimeMessages[0].type, 'COMMAND_EVENT');
  assert.equal(data[PLAYBACK_STATE_KEY].sequenceId, sequence.id);
  assert.equal(data[PLAYBACK_STATE_KEY].currentSegmentId, 'clip-command-play');
  assert.equal(data.messages.some((message) => message.type === 'PLAY_SEGMENT'), true);
});

test('background play-pause command pauses playback when the side panel is closed', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const sequence = makeSequence({
    id: 'sequence-command-stop',
    segments: [makeSegment({ id: 'clip-command-stop', videoId: 'video-1' })]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [PLAYBACK_STATE_KEY]: {
        sequenceId: sequence.id,
        segmentIndex: 0,
        currentSegmentId: 'clip-command-stop',
        tabId: 9,
        status: 'playing',
        startedAt: 1,
        playbackToken: 'token-command-stop',
        mode: 'sequence',
        order: [0],
        orderSegmentIds: ['clip-command-stop'],
        orderPosition: 0
      }
    },
    {
      runtimeSendMessageError: 'Could not establish connection. Receiving end does not exist.',
      sendMessageResponse(message) {
        if (message.type === 'GET_PAGE_INFO') {
          return { ok: true, data: { isYouTubeVideoPage: true, videoId: 'video-1', title: 'Video 1', url: 'https://www.youtube.com/watch?v=video-1', currentTime: 12, duration: 120 } };
        }
        return { ok: true };
      }
    }
  );
  await import('../.tmp-tests/src/background/background.js?command-play-pause-stop');

  data.commandListeners[0]('play-pause');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(data[PLAYBACK_STATE_KEY].status, 'paused');
  assert.equal(data.messages.some((message) => message.type === 'pause'), true);
  assert.equal(data.messages.some((message) => message.type === 'STOP_PLAYBACK'), false);
});

test('background next-clip command advances playback when the side panel is closed', async () => {
  const { STORAGE_KEY, PLAYBACK_STATE_KEY } = await import('../.tmp-tests/src/shared/storage.js');
  const { SETTINGS_KEY } = await import('../.tmp-tests/src/state/storage.js');
  const sequence = makeSequence({
    id: 'sequence-command-next',
    segments: [
      makeSegment({ id: 'clip-command-current', videoId: 'video-1', startSeconds: 10, endSeconds: 20 }),
      makeSegment({ id: 'clip-command-next', videoId: 'video-1', startSeconds: 30, endSeconds: 40 })
    ]
  });
  const data = installChrome(
    {
      [STORAGE_KEY]: {
        sequences: [sequence],
        selectedSequenceId: sequence.id
      },
      [SETTINGS_KEY]: settings({ autoNext: true }),
      [PLAYBACK_STATE_KEY]: {
        sequenceId: sequence.id,
        segmentIndex: 0,
        currentSegmentId: 'clip-command-current',
        tabId: 9,
        status: 'playing',
        startedAt: 1,
        playbackToken: 'token-command-next',
        mode: 'sequence',
        order: [0, 1],
        orderSegmentIds: ['clip-command-current', 'clip-command-next'],
        orderPosition: 0
      }
    },
    {
      runtimeSendMessageError: 'Could not establish connection. Receiving end does not exist.'
    }
  );
  await import('../.tmp-tests/src/background/background.js?command-next-clip');

  data.commandListeners[0]('next-clip');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(data[PLAYBACK_STATE_KEY].currentSegmentId, 'clip-command-next');
  assert.equal(data[PLAYBACK_STATE_KEY].segmentIndex, 1);
  assert.equal(data.messages.filter((message) => message.type === 'PLAY_SEGMENT').length, 1);
});
