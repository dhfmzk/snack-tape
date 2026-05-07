import test from 'node:test';
import assert from 'node:assert/strict';

test('getActiveVideoState injects content.js and retries when the existing YouTube tab has no content script', async () => {
  const injected = [];
  let sendCount = 0;

  globalThis.chrome = {
    runtime: { lastError: null },
    tabs: {
      async query() {
        return [
          {
            id: 11,
            url: 'https://www.youtube.com/watch?v=abc123XYZ_1',
            title: '재시도 영상 - YouTube'
          }
        ];
      },
      sendMessage(_tabId, message, callback) {
        assert.equal(message.type, 'getVideoState');
        sendCount += 1;

        if (sendCount === 1) {
          globalThis.chrome.runtime.lastError = { message: 'Receiving end does not exist.' };
          callback(undefined);
          globalThis.chrome.runtime.lastError = null;
          return;
        }

        callback({
          ok: true,
          data: {
            videoId: 'abc123XYZ_1',
            title: '재시도 영상',
            channel: '채널',
            currentTime: 12.345,
            duration: 98.765,
            paused: false
          }
        });
      }
    },
    scripting: {
      async executeScript(payload) {
        injected.push(payload);
      }
    }
  };

  const { getActiveVideoState } = await import('../.tmp-tests/src/state/youtube.js');

  const result = await getActiveVideoState();

  assert.equal(sendCount, 2);
  assert.deepEqual(injected, [
    {
      target: { tabId: 11 },
      files: ['content.js']
    }
  ]);
  assert.equal(result.error, null);
  assert.equal(result.info.currentTime, 12.345);
  assert.equal(result.info.duration, 98.765);
});
