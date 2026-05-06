import type { Sequence } from './types.js';

function isValidIndex(length: number, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (!isValidIndex(items.length, fromIndex) || !isValidIndex(items.length, toIndex)) {
    return [...items];
  }

  if (fromIndex === toIndex) {
    return [...items];
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function moveSegment(sequence: Sequence, segmentId: string, direction: -1 | 1): Sequence {
  const currentIndex = sequence.segments.findIndex((segment) => segment.id === segmentId);
  const targetIndex = currentIndex + direction;

  if (!isValidIndex(sequence.segments.length, currentIndex) || !isValidIndex(sequence.segments.length, targetIndex)) {
    return {
      ...sequence,
      segments: [...sequence.segments]
    };
  }

  return {
    ...sequence,
    segments: moveItem(sequence.segments, currentIndex, targetIndex),
    updatedAt: Date.now()
  };
}

export function moveSegmentUp(sequence: Sequence, segmentId: string): Sequence {
  return moveSegment(sequence, segmentId, -1);
}

export function moveSegmentDown(sequence: Sequence, segmentId: string): Sequence {
  return moveSegment(sequence, segmentId, 1);
}
