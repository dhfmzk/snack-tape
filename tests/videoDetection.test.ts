// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';

test('active video detection coalesces tab and focus refreshes', async () => {
  const listeners = {};
  globalThis.chrome = {
    tabs: {
      onActivated: {
        addListener(listener) {
          listeners.activated = listener;
        }
      },
      onUpdated: {
        addListener(listener) {
          listeners.updated = listener;
        }
      }
    },
    windows: {
      WINDOW_ID_NONE: -1,
      onFocusChanged: {
        addListener(listener) {
          listeners.windowFocus = listener;
        }
      }
    }
  };
  const windowListeners = {};
  const documentListeners = {};
  const fakeWindow = {
    addEventListener(type, listener) {
      windowListeners[type] = listener;
    }
  };
  const fakeDocument = {
    hidden: true,
    addEventListener(type, listener) {
      documentListeners[type] = listener;
    }
  };
  const calls = [];
  const scheduled = [];
  const store = {
    async syncActiveVideoForCapture() {
      calls.push('sync');
    }
  };
  const { installActiveVideoDetection } = await import('../src/state/videoDetection.js');

  installActiveVideoDetection(store, fakeWindow, fakeDocument, (callback) => scheduled.push(callback));
  listeners.activated({ tabId: 1 });
  listeners.updated(1, { url: 'https://www.youtube.com/watch?v=abc123XYZ_1' }, { active: false });
  listeners.updated(1, { status: 'complete' }, { active: true });
  listeners.windowFocus(globalThis.chrome.windows.WINDOW_ID_NONE);
  listeners.windowFocus(3);
  fakeDocument.hidden = false;
  documentListeners.visibilitychange();
  windowListeners.focus();

  assert.equal(calls.length, 0);
  assert.equal(scheduled.length, 1);
  scheduled[0]();
  assert.equal(calls.length, 1);
});
