// @ts-nocheck
export function makeSegment(overrides = {}) {
  const now = 1700000000000;
  return {
    id: 'segment-1',
    videoId: 'abc123XYZ_1',
    originalUrl: 'https://www.youtube.com/watch?v=abc123XYZ_1',
    title: '테스트 영상',
    startSeconds: 10,
    endSeconds: 20,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function makeSequence(overrides = {}) {
  const now = 1700000000000;
  return {
    id: 'sequence-1',
    name: '테스트 시퀀스',
    segments: [makeSegment({ id: 'a' }), makeSegment({ id: 'b' }), makeSegment({ id: 'c' })],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}
