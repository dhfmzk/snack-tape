import { Thumb } from '../components/Thumb.js';
import { el } from '../components/dom.js';
import { Glyph } from '../components/Glyph.js';
import { formatSeconds } from '../shared/time.js';
import type { PlaybackMode, Segment, Sequence } from '../shared/types.js';
import type { AppState } from '../state/store.js';

type Props = {
  state: AppState;
  onBack: () => void;
  onPlay: (index: number, sequenceId?: string, mode?: PlaybackMode) => void;
  onStop: () => void;
  onNext: () => void;
  onEditSequence: (sequenceId: string) => void;
  onRenameSequence?: (sequenceId: string) => void;
  onCancelQueueEdit: () => void;
  onSaveQueueEdit: () => void;
  onMoveQueueSegment: (fromIndex: number, toIndex: number) => void;
  onRemoveQueueSegment: (segmentId: string) => void;
};

type Style = Partial<CSSStyleDeclaration>;

function playbackSequence(state: AppState): Sequence | null {
  const sequences = state.store?.sequences ?? [];

  if (state.playbackState?.sequenceId) {
    const activeSequence = sequences.find((sequence) => sequence.id === state.playbackState?.sequenceId);
    if (activeSequence) {
      return activeSequence;
    }
  }

  if (state.store?.selectedSequenceId) {
    const selectedSequence = sequences.find((sequence) => sequence.id === state.store?.selectedSequenceId);
    if (selectedSequence) {
      return selectedSequence;
    }
  }

  return sequences[0] ?? null;
}

function currentSegment(state: AppState, sequence: Sequence | null): { segment: Segment | null; index: number } {
  if (!sequence || !state.playbackState) {
    return { segment: sequence?.segments[0] ?? null, index: 0 };
  }

  const byId = state.playbackState.currentSegmentId
    ? sequence.segments.findIndex((segment) => segment.id === state.playbackState?.currentSegmentId)
    : -1;
  const index = byId >= 0 ? byId : state.playbackState.segmentIndex;
  return { segment: sequence.segments[index] ?? sequence.segments[0] ?? null, index };
}

function clipDuration(segment: Segment): number {
  if (!segment.endSeconds || segment.endSeconds <= segment.startSeconds) {
    return 0;
  }

  return segment.endSeconds - segment.startSeconds;
}

function totalDuration(sequence: Sequence): number {
  return sequence.segments.reduce((sum, segment) => sum + clipDuration(segment), 0);
}

function timeRange(segment: Segment): string {
  return `${formatSeconds(segment.startSeconds)} → ${segment.endSeconds ? formatSeconds(segment.endSeconds) : 'END'}`;
}

function progress(state: AppState, segment: Segment | null): { ratio: number; elapsed: number; duration: number; remaining: number; animate: boolean } {
  if (!segment) {
    return { ratio: 0, elapsed: 0, duration: 0, remaining: 0, animate: false };
  }

  const duration = clipDuration(segment);
  if (duration <= 0) {
    return { ratio: 0, elapsed: 0, duration, remaining: 0, animate: false };
  }

  let elapsed: number | null = null;
  if (
    state.playbackState?.status === 'playing'
    && (!state.playbackState.currentSegmentId || state.playbackState.currentSegmentId === segment.id)
    && Number.isFinite(state.playbackState.startedAt)
  ) {
    elapsed = (Date.now() - state.playbackState.startedAt) / 1000;
  } else {
    const pageTime = state.pageInfo?.videoId === segment.videoId ? state.pageInfo.currentTime : null;
    if (pageTime !== null && pageTime !== undefined) {
      elapsed = pageTime - segment.startSeconds;
    }
  }

  if (elapsed === null) {
    return { ratio: 0, elapsed: 0, duration, remaining: duration, animate: false };
  }

  const clampedElapsed = Math.max(0, Math.min(duration, elapsed));
  const ratio = Math.max(0, Math.min(1, clampedElapsed / duration));
  const remaining = Math.max(0, duration - clampedElapsed);
  return {
    ratio,
    elapsed: clampedElapsed,
    duration,
    remaining,
    animate: state.playbackState?.status === 'playing' && remaining > 0 && ratio < 1,
  };
}

function progressPercent(ratio: number): string {
  return `${Number((ratio * 100).toFixed(4))}%`;
}

function progressAnimation(progressState: ReturnType<typeof progress>, target: 'fill' | 'knob'): string {
  if (!progressState.animate) {
    return '';
  }

  const name = target === 'fill' ? 'snacktape-progress-fill' : 'snacktape-progress-knob';
  return `--progress-start: ${progressPercent(progressState.ratio)}; animation: ${name} ${Number(progressState.remaining.toFixed(2))}s linear forwards;`;
}

function btnIconStyle(extra: Style = {}): Style {
  return {
    width: '30px',
    height: '30px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text2)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    ...extra,
  };
}

function thumbStyle(thumb: HTMLElement, width: number | string, height: number | string, dim = false): HTMLElement {
  Object.assign(thumb.style, {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    flexShrink: '0',
    position: 'relative',
    overflow: 'hidden',
    filter: dim ? 'grayscale(0.6) brightness(0.6)' : 'none',
    borderRadius: '4px',
  } satisfies Style);
  return thumb;
}

function modeFromState(state: AppState): PlaybackMode {
  return state.playbackState?.mode ?? (state.settings.shuffleByDefault ? 'shuffle' : 'sequence');
}

function queueActionButtonStyle(disabled = false): Style {
  return {
    width: '28px',
    height: '28px',
    border: '1px solid var(--hairline2)',
    background: 'var(--surface2)',
    color: 'var(--text2)',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? '0.35' : '1',
    flexShrink: '0',
  };
}

function editTextButtonStyle(accent = false): Style {
  return {
    height: '32px',
    padding: '0 14px',
    border: `1px solid ${accent ? 'var(--accent)' : 'var(--hairline2)'}`,
    background: accent ? 'var(--accent)' : 'var(--surface2)',
    color: accent ? 'var(--accent-ink)' : 'var(--text2)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: accent ? '700' : '600',
    cursor: 'pointer',
  };
}

export function Playback({
  state,
  onBack,
  onPlay,
  onStop,
  onNext,
  onEditSequence,
  onRenameSequence,
  onCancelQueueEdit,
  onSaveQueueEdit,
  onMoveQueueSegment,
  onRemoveQueueSegment,
}: Props): HTMLElement {
  const sequence = playbackSequence(state);
  const { segment, index } = currentSegment(state, sequence);
  const isPlaying = state.playbackDisplay?.canStop === true;
  const progressState = progress(state, segment);

  if (!sequence || sequence.segments.length === 0 || !segment) {
    return el(
      'div',
      {
        dataset: { scrollKey: `playback-empty:${sequence?.id ?? state.store?.selectedSequenceId ?? 'none'}` },
        style: { flex: '1', overflow: 'auto', padding: '14px' },
      },
      el(
        'section',
        {
          style: {
            border: '1px solid var(--hairline)',
            background: 'var(--surface)',
            borderRadius: '10px',
            padding: '18px',
          },
        },
        el('p', { text: '재생할 클립이 없습니다', style: { margin: '0 0 6px', fontSize: '14px', fontWeight: '700', color: 'var(--text)' } }),
        el('p', { text: '캡처 탭에서 첫 구간을 저장하면 큐가 만들어집니다.', style: { margin: '0', color: 'var(--mute)', fontSize: '12px', lineHeight: '1.5' } })
      )
    );
  }

  const currentMode = modeFromState(state);
  const nextIndex = Math.min(index + 1, sequence.segments.length - 1);
  const previousIndex = Math.max(0, index - 1);
  const upNextCount = Math.max(0, sequence.segments.length - index - 1);
  const queueEdit = state.queueEdit?.sequenceId === sequence.id ? state.queueEdit : null;
  const isEditingQueue = Boolean(queueEdit);
  const queueSegments = queueEdit
    ? queueEdit.segmentIds
        .map((segmentId) => sequence.segments.find((item) => item.id === segmentId) ?? null)
        .filter((item): item is Segment => item !== null)
    : sequence.segments;
  let draggedIndex: number | null = null;

  return el(
    'div',
    { style: { flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '0' } },
    el(
      'div',
      {
        style: {
          padding: '12px 14px 14px',
          borderBottom: '1px solid var(--hairline)',
          background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)',
        },
      },
      el(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } },
        el('button', { ariaLabel: '믹스테이프로 돌아가기', onClick: onBack, style: btnIconStyle() }, Glyph('back', 14)),
        el(
          'div',
          { style: { flex: '1', minWidth: '0' } },
          el('span', {
            text: isPlaying ? 'NOW PLAYING' : 'READY',
            style: {
              fontSize: '9.5px',
              color: 'var(--accent)',
              fontFamily: 'JetBrains Mono',
              letterSpacing: '1px',
              fontWeight: '600',
            },
          }),
          el(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' } },
            el('div', {
              text: sequence.name,
              style: {
                flex: '1',
                minWidth: '0',
                fontSize: '15px',
                fontWeight: '700',
                color: 'var(--text)',
                letterSpacing: '-0.3px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            }),
            el(
              'button',
              {
                ariaLabel: '믹스테이프 이름 변경',
                title: '믹스테이프 이름 변경',
                onClick: () => onRenameSequence?.(sequence.id),
                style: btnIconStyle({ width: '24px', height: '24px', color: 'var(--accent)' }),
              },
              Glyph('edit', 11)
            )
          ),
          el(
            'div',
            { style: { display: 'flex', gap: '6px', marginTop: '3px', fontFamily: 'JetBrains Mono', fontSize: '9.5px', color: 'var(--mute)' } },
            el('span', { text: `${index + 1} / ${sequence.segments.length}` }),
            el('span', { text: '·', style: { color: 'var(--mute2)' } }),
            el('span', { text: formatSeconds(totalDuration(sequence)) })
          )
        )
      ),
      el(
        'div',
        { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        thumbStyle(Thumb({ themeKey: state.settings.accentKey, videoId: segment.videoId, variant: index }), 88, 88),
        el(
          'div',
          { style: { flex: '1', minWidth: '0' } },
          el('div', {
            text: segment.title,
            style: {
              fontSize: '17px',
              fontWeight: '700',
              color: 'var(--text)',
              lineHeight: '1.25',
              letterSpacing: '-0.4px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: '2',
              WebkitBoxOrient: 'vertical',
            } as Style,
          }),
          el('div', {
            text: `↳ ${sequence.name}`,
            style: {
              fontSize: '11px',
              color: 'var(--text2)',
              marginTop: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          }),
          el(
            'div',
            { style: { marginTop: '8px' } },
            el('span', {
              text: timeRange(segment),
              style: {
                fontFamily: 'JetBrains Mono',
                fontSize: '9.5px',
                color: 'var(--accent)',
                padding: '2px 6px',
                background: 'var(--accent-soft)',
                borderRadius: '3px',
                fontWeight: '600',
              },
            })
          )
        )
      ),
      el(
        'div',
        { style: { marginTop: '14px' } },
        el(
          'div',
          {
            ariaLabel: '재생 진행률',
            role: 'progressbar',
            dataset: { progressRatio: String(Number(progressState.ratio.toFixed(4))) },
            style: { height: '5px', background: 'var(--surface3)', borderRadius: '999px', position: 'relative' },
          },
          el('div', {
            style: `position: absolute; left: 0; top: 0; bottom: 0; width: ${progressPercent(progressState.ratio)}; background: var(--accent); border-radius: 999px; ${progressAnimation(progressState, 'fill')}`,
          }),
          el('div', {
            style: `position: absolute; left: clamp(4.5px, ${progressPercent(progressState.ratio)}, calc(100% - 4.5px)); top: 50%; width: 9px; height: 9px; border-radius: 5px; background: var(--accent); transform: translate(-50%, -50%); box-shadow: 0 0 10px var(--accent-glow); ${progressAnimation(progressState, 'knob')}`,
          })
        ),
        el(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontFamily: 'JetBrains Mono', fontSize: '10px' } },
          el('span', { text: formatSeconds(progressState.elapsed), style: { color: 'var(--text2)' } }),
          el('span', { text: formatSeconds(progressState.duration), style: { color: 'var(--mute)' } })
        )
      ),
      el(
        'div',
        { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginTop: '12px', color: 'var(--text2)' } },
        el('button', { ariaLabel: '셔플 재생', onClick: () => onPlay(index, sequence.id, 'shuffle'), style: btnIconStyle() }, Glyph('shuffle', 14)),
        el('button', { ariaLabel: '이전 클립', onClick: () => onPlay(previousIndex, sequence.id, currentMode), style: btnIconStyle({ width: '32px', height: '32px' }) }, Glyph('prev', 16)),
        el(
          'button',
          {
            ariaLabel: isPlaying ? '정지' : '재생',
            onClick: () => (isPlaying ? onStop() : onPlay(index, sequence.id, currentMode)),
            style: {
              width: '48px',
              height: '48px',
              borderRadius: '24px',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 20px var(--accent-glow)',
            },
          },
          Glyph(isPlaying ? 'pause' : 'play', 16)
        ),
        el('button', {
          ariaLabel: '다음 클립',
          onClick: () => (isPlaying ? onNext() : onPlay(nextIndex, sequence.id, currentMode)),
          style: btnIconStyle({ width: '32px', height: '32px' }),
        }, Glyph('next', 16)),
        el('button', { ariaLabel: '현재 클립 다시 재생', onClick: () => onPlay(index, sequence.id, currentMode), style: btnIconStyle() }, Glyph('repeat', 14))
      )
    ),
    el(
      'div',
      { style: { padding: '14px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      el('span', {
        text: 'QUEUE',
        style: { fontFamily: 'JetBrains Mono', fontSize: '11px', fontWeight: '600', color: 'var(--text)', letterSpacing: '0.6px' },
      }),
      isEditingQueue
        ? el('span', {
            text: '편집 중',
            style: { fontFamily: 'JetBrains Mono', fontSize: '9.5px', color: 'var(--accent)' },
          })
        : el('button', {
            text: '편집',
            ariaLabel: '믹스테이프 편집',
            onClick: () => onEditSequence(sequence.id),
            style: {
              border: '1px solid var(--hairline2)',
              background: 'var(--surface2)',
              color: 'var(--text2)',
              height: '26px',
              padding: '0 10px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: '600',
              cursor: 'pointer',
            },
          })
    ),
    el(
      'div',
      {
        dataset: { scrollKey: `playback-queue:${sequence.id}` },
        style: { flex: '1', overflow: 'auto', padding: '0 8px 8px', minHeight: '0' },
      },
      ...queueSegments.map((queueSegment, queueIndex) => {
        const originalIndex = sequence.segments.findIndex((item) => item.id === queueSegment.id);
        const done = !isEditingQueue && originalIndex < index;
        const now = queueSegment.id === segment.id;

        if (isEditingQueue) {
          const canMoveUp = queueIndex > 0;
          const canMoveDown = queueIndex < queueSegments.length - 1;
          const canRemove = !now;
          return el(
            'div',
            {
              draggable: true,
              onDragStart: (event) => {
                draggedIndex = queueIndex;
                event.dataTransfer?.setData('text/plain', String(queueIndex));
              },
              onDragOver: (event) => event.preventDefault(),
              onDrop: (event) => {
                event.preventDefault();
                const transferIndex = Number(event.dataTransfer?.getData('text/plain'));
                const fromIndex = draggedIndex ?? (Number.isInteger(transferIndex) ? transferIndex : -1);
                draggedIndex = null;
                if (fromIndex >= 0 && fromIndex !== queueIndex) {
                  onMoveQueueSegment(fromIndex, queueIndex);
                }
              },
              onDragEnd: () => {
                draggedIndex = null;
              },
              style: {
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 8px',
                background: now ? 'var(--accent-soft)' : 'transparent',
                borderRadius: '6px',
                borderLeft: now ? '2px solid var(--accent)' : '2px solid transparent',
                color: 'inherit',
                cursor: 'grab',
              },
            },
            el('div', { style: { width: '16px', display: 'flex', justifyContent: 'center', color: 'var(--mute)' } }, Glyph('grip', 13)),
            thumbStyle(Thumb({ themeKey: state.settings.accentKey, videoId: queueSegment.videoId, variant: originalIndex }), 40, 40),
            el(
              'div',
              { style: { flex: '1', minWidth: '0' } },
              el('div', {
                text: queueSegment.title,
                style: {
                  fontSize: '12px',
                  fontWeight: now ? '600' : '500',
                  color: now ? 'var(--text)' : 'var(--text2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }),
              el('div', {
                text: timeRange(queueSegment),
                style: {
                  fontSize: '10px',
                  color: 'var(--mute)',
                  marginTop: '1px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              })
            ),
            el(
              'div',
              { style: { display: 'flex', gap: '4px', flexShrink: '0' } },
              el('button', {
                ariaLabel: `${queueSegment.title} 위로 이동`,
                disabled: !canMoveUp,
                onClick: () => canMoveUp && onMoveQueueSegment(queueIndex, queueIndex - 1),
                style: queueActionButtonStyle(!canMoveUp),
              }, Glyph('up', 12)),
              el('button', {
                ariaLabel: `${queueSegment.title} 아래로 이동`,
                disabled: !canMoveDown,
                onClick: () => canMoveDown && onMoveQueueSegment(queueIndex, queueIndex + 1),
                style: queueActionButtonStyle(!canMoveDown),
              }, Glyph('down', 12)),
              el('button', {
                ariaLabel: `${queueSegment.title} 큐에서 제거`,
                disabled: !canRemove,
                onClick: () => canRemove && onRemoveQueueSegment(queueSegment.id),
                style: queueActionButtonStyle(!canRemove),
              }, Glyph('x', 12))
            )
          );
        }

        return el(
          'button',
          {
            ariaLabel: `${queueSegment.title} 재생`,
            onClick: () => onPlay(originalIndex, sequence.id, currentMode),
            style: {
              width: '100%',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 8px',
              background: now ? 'var(--accent-soft)' : 'transparent',
              borderRadius: '6px',
              opacity: done ? '0.4' : '1',
              borderLeft: now ? '2px solid var(--accent)' : '2px solid transparent',
              color: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
            },
          },
          el(
            'div',
            { style: { width: '16px', display: 'flex', justifyContent: 'center', color: now ? 'var(--accent)' : 'var(--mute)' } },
            now ? Glyph('play', 10) : el('span', { text: String(queueIndex + 1), style: { fontFamily: 'JetBrains Mono', fontSize: '10px' } })
          ),
          thumbStyle(Thumb({ themeKey: state.settings.accentKey, videoId: queueSegment.videoId, variant: originalIndex }), 40, 40, done),
          el(
            'div',
            { style: { flex: '1', minWidth: '0' } },
            el('div', {
              text: queueSegment.title,
              style: {
                fontSize: '12px',
                fontWeight: now ? '600' : '500',
                color: now ? 'var(--text)' : done ? 'var(--mute)' : 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: done ? 'line-through' : 'none',
              },
            }),
            el('div', {
              text: timeRange(queueSegment),
              style: {
                fontSize: '10px',
                color: 'var(--mute)',
                marginTop: '1px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            })
          ),
          el('span', { text: formatSeconds(clipDuration(queueSegment)), style: { fontFamily: 'JetBrains Mono', fontSize: '10px', color: 'var(--mute)' } })
        );
      })
    ),
    isEditingQueue
      ? el(
          'div',
          {
            style: {
              flexShrink: '0',
              padding: '10px 14px',
              borderTop: '1px solid var(--hairline)',
              background: 'var(--surface)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            },
          },
          el('button', { text: '취소', ariaLabel: '큐 편집 취소', onClick: onCancelQueueEdit, style: editTextButtonStyle() }),
          el('button', { text: '완료', ariaLabel: '큐 편집 완료', onClick: onSaveQueueEdit, style: editTextButtonStyle(true) })
        )
      : null
  );
}
