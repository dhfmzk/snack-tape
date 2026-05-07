import type { PlaybackMode, PlaybackState, Sequence, SnackTapeStore } from './types.js';

export type PlaybackStep = {
  segmentIndex: number;
  orderPosition: number;
};

export type PlaybackDisplayState = {
  sequenceName: string;
  segmentTitle: string;
  positionText: string;
  modeLabel: string;
  canStop: boolean;
};

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

export function createPlaybackOrder(
  segmentCount: number,
  startIndex = 0,
  mode: PlaybackMode = 'sequence',
  random: () => number = Math.random
): number[] {
  if (!Number.isInteger(segmentCount) || segmentCount <= 0 || startIndex < 0 || startIndex >= segmentCount) {
    return [];
  }

  if (mode !== 'shuffle') {
    return Array.from({ length: segmentCount - startIndex }, (_, index) => startIndex + index);
  }

  const remaining = Array.from({ length: segmentCount }, (_, index) => index).filter((index) => index !== startIndex);
  const shuffled: number[] = [];

  while (remaining.length > 0) {
    const randomValue = random();
    const safeRandom = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.999999999) : 0;
    const nextIndex = Math.floor(safeRandom * remaining.length);
    const [next] = remaining.splice(nextIndex, 1);
    shuffled.push(next);
  }

  return [startIndex, ...shuffled];
}

function isValidIndex(sequence: Sequence, index: number | undefined): index is number {
  return Number.isInteger(index) && index !== undefined && index >= 0 && index < sequence.segments.length;
}

function findSegmentIndex(sequence: Sequence, segmentId: string | undefined): number {
  return segmentId ? sequence.segments.findIndex((segment) => segment.id === segmentId) : -1;
}

function stateOrderPosition(sequence: Sequence, state: PlaybackState): number {
  if (Number.isInteger(state.orderPosition) && state.orderPosition !== undefined) {
    return state.orderPosition;
  }

  if (state.orderSegmentIds && state.currentSegmentId) {
    return state.orderSegmentIds.findIndex((segmentId) => segmentId === state.currentSegmentId);
  }

  if (state.order && state.order.length > 0) {
    return state.order.findIndex((index) => index === state.segmentIndex);
  }

  const currentIndex = findSegmentIndex(sequence, state.currentSegmentId);
  return currentIndex >= 0 ? currentIndex : state.segmentIndex;
}

export function getNextPlaybackStep(sequence: Sequence, state: PlaybackState): PlaybackStep | null {
  if (sequence.segments.length === 0) {
    return null;
  }

  if (state.orderSegmentIds && state.orderSegmentIds.length > 0) {
    const currentPosition = stateOrderPosition(sequence, state);

    for (let nextPosition = currentPosition + 1; nextPosition < state.orderSegmentIds.length; nextPosition += 1) {
      const nextSegmentIndex = findSegmentIndex(sequence, state.orderSegmentIds[nextPosition]);
      if (nextSegmentIndex >= 0) {
        return {
          segmentIndex: nextSegmentIndex,
          orderPosition: nextPosition
        };
      }
    }

    return null;
  }

  if (state.order && state.order.length > 0) {
    const currentPosition = stateOrderPosition(sequence, state);
    const nextPosition = currentPosition + 1;
    const nextSegmentIndex = state.order[nextPosition];

    if (!isValidIndex(sequence, nextSegmentIndex)) {
      return null;
    }

    return {
      segmentIndex: nextSegmentIndex,
      orderPosition: nextPosition
    };
  }

  const nextIndex = getNextSegmentIndex(sequence, state.segmentIndex);
  if (nextIndex === null) {
    return null;
  }

  return {
    segmentIndex: nextIndex,
    orderPosition: nextIndex
  };
}

export function describePlaybackState(store: SnackTapeStore, state: PlaybackState | null): PlaybackDisplayState | null {
  if (!state || (state.status !== 'playing' && state.status !== 'waiting' && state.status !== 'pending')) {
    return null;
  }

  const sequence = store.sequences.find((item) => item.id === state.sequenceId);
  if (!sequence) {
    return null;
  }

  const currentSegmentIndex = findSegmentIndex(sequence, state.currentSegmentId);
  const segment = sequence.segments[currentSegmentIndex >= 0 ? currentSegmentIndex : state.segmentIndex];
  if (!segment) {
    return null;
  }

  const totalCount = state.orderSegmentIds && state.orderSegmentIds.length > 0
    ? state.orderSegmentIds.length
    : state.order && state.order.length > 0
      ? state.order.length
      : sequence.segments.length;
  const currentPosition = stateOrderPosition(sequence, state);
  const positionText = currentPosition >= 0 ? `${currentPosition + 1} / ${totalCount}` : `? / ${totalCount}`;

  return {
    sequenceName: sequence.name,
    segmentTitle: segment.title,
    positionText,
    modeLabel: state.mode === 'shuffle' ? '랜덤 재생' : '순서대로 재생',
    canStop: true
  };
}

export function playbackStateAfterSequenceEdit(state: PlaybackState, sequence: Sequence): PlaybackState {
  const currentIndex = findSegmentIndex(sequence, state.currentSegmentId);
  const fallbackIndex = isValidIndex(sequence, state.segmentIndex) ? state.segmentIndex : 0;
  const nextIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
  const currentSegment = sequence.segments[nextIndex];
  const order = sequence.segments.map((_segment, index) => index);
  const orderSegmentIds = sequence.segments.map((segment) => segment.id);

  return {
    ...state,
    segmentIndex: nextIndex,
    currentSegmentId: currentSegment?.id ?? state.currentSegmentId,
    mode: state.mode ?? 'sequence',
    order,
    orderSegmentIds,
    orderPosition: nextIndex
  };
}
