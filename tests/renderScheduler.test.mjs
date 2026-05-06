import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameRenderScheduler } from '../.tmp-tests/src/shared/renderScheduler.js';

test('createFrameRenderScheduler coalesces repeated state updates into one frame render', () => {
  const callbacks = [];
  const renders = [];
  const schedule = createFrameRenderScheduler(
    (value) => renders.push(value),
    (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    }
  );

  schedule('first');
  schedule('second');
  schedule('third');

  assert.deepEqual(renders, []);
  assert.equal(callbacks.length, 1);

  callbacks.shift()(16);

  assert.deepEqual(renders, ['third']);

  schedule('fourth');

  assert.equal(callbacks.length, 1);
});
