import test from 'node:test';
import assert from 'node:assert/strict';

test('failureResponse uses unknown code without a hardcoded English message for non-error values', async () => {
  const { failureResponse } = await import('../.tmp-tests/src/shared/errors.js');

  assert.deepEqual(failureResponse({ reason: 'not-an-error' }), {
    ok: false,
    errorCode: 'unknown'
  });
});
