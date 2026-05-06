import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSeconds, parseTimeToSeconds } from '../.tmp-tests/src/shared/time.js';

test('parseTimeToSeconds parses seconds, mm:ss, and h:mm:ss', () => {
  assert.equal(parseTimeToSeconds('305'), 305);
  assert.equal(parseTimeToSeconds('05:05'), 305);
  assert.equal(parseTimeToSeconds('1:02:03'), 3723);
  assert.equal(parseTimeToSeconds('00:00'), 0);
  assert.equal(parseTimeToSeconds('0:30'), 30);
});

test('parseTimeToSeconds rejects malformed or negative values', () => {
  for (const value of ['-1', 'abc', '1:2:3:4', '1::2']) {
    assert.equal(parseTimeToSeconds(value), null);
  }
});

test('formatSeconds formats seconds as mm:ss or h:mm:ss', () => {
  assert.equal(formatSeconds(305), '05:05');
  assert.equal(formatSeconds(3723), '1:02:03');
  assert.equal(formatSeconds(30), '00:30');
  assert.equal(formatSeconds(0), '00:00');
});
