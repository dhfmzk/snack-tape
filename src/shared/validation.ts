import type { Segment, Sequence } from './types.js';

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function validateSegment(segment: Segment): string[] {
  const errors: string[] = [];

  if (!segment.videoId.trim()) {
    errors.push('영상 ID를 확인해주세요.');
  }

  if (!segment.title.trim()) {
    errors.push('영상 제목을 확인해주세요.');
  }

  if (!isFiniteNonNegative(segment.startSeconds)) {
    errors.push('시작점은 0초 이상이어야 합니다.');
  }

  if (segment.endSeconds !== null) {
    if (!isFiniteNonNegative(segment.endSeconds)) {
      errors.push('끝점은 비워두거나 0초 이상이어야 합니다.');
    } else if (segment.endSeconds > 0 && segment.endSeconds <= segment.startSeconds) {
      errors.push('끝점은 시작점보다 뒤에 있어야 합니다.');
    }
  }

  return errors;
}

export function validateSequence(sequence: Sequence): string[] {
  const errors: string[] = [];

  if (!sequence.name.trim()) {
    errors.push('시퀀스 이름을 입력해주세요.');
  }

  if (sequence.segments.length === 0) {
    errors.push('재생할 구간이 없습니다.');
  }

  sequence.segments.forEach((segment, index) => {
    const segmentErrors = validateSegment(segment);
    for (const error of segmentErrors) {
      errors.push(`${index + 1}번째 구간: ${error}`);
    }
  });

  return errors;
}
