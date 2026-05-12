// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';

test('playback progress sync polls the store at a short fixed interval', async () => {
  const { installPlaybackProgressSync, PLAYBACK_PROGRESS_SYNC_MS } = await import('../src/state/playbackProgressSync.js');
  const calls = [];
  const timers = [];
  const store = {
    async syncPlaybackProgress() {
      calls.push('sync');
    }
  };

  installPlaybackProgressSync(store, (callback, interval) => {
    timers.push({ callback, interval });
    return timers.length;
  });

  assert.equal(timers.length, 1);
  assert.equal(timers[0].interval, PLAYBACK_PROGRESS_SYNC_MS);

  timers[0].callback();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(calls, ['sync']);
});
