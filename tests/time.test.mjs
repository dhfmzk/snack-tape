import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSeconds, formatTimecode, parseTimecodeToSeconds, parseTimeToSeconds } from '../.tmp-tests/src/shared/time.js';

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

test('parseTimeToSeconds rejects out-of-range minutes or seconds', () => {
  assert.equal(parseTimeToSeconds('60:00'), null);
  assert.equal(parseTimeToSeconds('00:60'), null);
  assert.equal(parseTimeToSeconds('1:60:00'), null);
  assert.equal(parseTimeToSeconds('1:00:60'), null);
});

test('parseTimeToSeconds handles boundary mm:ss values', () => {
  assert.equal(parseTimeToSeconds('59:59'), 3599);
  assert.equal(parseTimeToSeconds('0:00'), 0);
  assert.equal(parseTimeToSeconds('  10  '), 10);
});

test('parseTimecodeToSeconds parses exact edit timecodes with hundredths', () => {
  assert.equal(parseTimecodeToSeconds('12.5'), 12.5);
  assert.equal(parseTimecodeToSeconds('00:12.50'), 12.5);
  assert.equal(parseTimecodeToSeconds('1:02:03.25'), 3723.25);
  assert.equal(parseTimecodeToSeconds('  01:10.05  '), 70.05);
});

test('parseTimecodeToSeconds rejects malformed exact edit timecodes', () => {
  for (const value of ['bad', '-1', '1::2', '00:60', '01:02.999']) {
    assert.equal(parseTimecodeToSeconds(value), null);
  }
});

test('formatSeconds formats seconds as mm:ss or h:mm:ss', () => {
  assert.equal(formatSeconds(305), '05:05');
  assert.equal(formatSeconds(3723), '1:02:03');
  assert.equal(formatSeconds(30), '00:30');
  assert.equal(formatSeconds(0), '00:00');
});

test('formatSeconds clamps negative input to 00:00', () => {
  assert.equal(formatSeconds(-5), '00:00');
  assert.equal(formatSeconds(-100), '00:00');
});

test('formatSeconds truncates fractional seconds', () => {
  assert.equal(formatSeconds(30.9), '00:30');
  assert.equal(formatSeconds(59.999), '00:59');
});

test('formatTimecode includes hundredths for sub-minute durations', () => {
  assert.equal(formatTimecode(0), '00:00.00');
  assert.equal(formatTimecode(5.25), '00:05.25');
  assert.equal(formatTimecode(70.5), '01:10.50');
});

test('formatTimecode uses h:mm:ss format for durations over one hour', () => {
  assert.equal(formatTimecode(3600), '1:00:00');
  assert.equal(formatTimecode(3723.99), '1:02:03');
});

test('formatTimecode clamps negative input to 00:00.00', () => {
  assert.equal(formatTimecode(-5), '00:00.00');
});
