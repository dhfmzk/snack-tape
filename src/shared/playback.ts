import type { Sequence } from './types.js';

export function getNextSegmentIndex(sequence: Sequence, currentIndex: number): number | null {
  if (sequence.segments.length === 0 || currentIndex < 0) {
    return null;
  }

  const nextIndex = currentIndex + 1;
  return nextIndex < sequence.segments.length ? nextIndex : null;
}

export function isFinalSegment(sequence: Sequence, currentIndex: number): boolean {
  if (sequence.segments.length === 0 || currentIndex < 0) {
    return false;
  }

  return currentIndex === sequence.segments.length - 1;
}
