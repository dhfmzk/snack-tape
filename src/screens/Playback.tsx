import { Thumb } from '../components/Thumb.js';
import { el } from '../components/dom.js';
import { Glyph } from '../components/Glyph.js';
import { createI18n, type I18n } from '../i18n.js';
import { formatSeconds } from '../shared/time.js';
import type { PlaybackMode, Segment, Sequence } from '../shared/types.js';
import type { AppState, PlaybackRecoveryAction } from '../state/store.js';

type Props = {
  state: AppState;
  i18n?: I18n;
  onBack: () => void;
  onPlay: (index: number, sequenceId?: string, mode?: PlaybackMode) => void;
  onPlayQueueFrom?: (sequenceId: string, segmentId: string, queueSegmentIds: string[]) => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop: () => void;
  onNext: () => void;
  onSeek?: (seconds: number) => void;
  onRetryPlayback?: () => void;
  onEditSequence: (sequenceId: string) => void;
  onEditSegment?: (sequenceId: string, segmentId: string) => void;
  onBeginQueueEdit: (sequenceId: string) => void;
  onRenameSequence?: (sequenceId: string) => void;
  onCancelQueueEdit: () => void;
  onSaveQueueEdit: () => void;
  onMoveQueueSegment: (fromIndex: number, toIndex: number) => void;
  onRemoveQueueSegment: (segmentId: string) => void;
  onRemovePlaybackQueueSegment?: (segmentId: string) => void;
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
  if (segment.endSeconds === null || segment.endSeconds <= segment.startSeconds) {
    return 0;
  }

  return segment.endSeconds - segment.startSeconds;
}

function totalDuration(sequence: Sequence): number {
  return sequence.segments.reduce((sum, segment) => sum + clipDuration(segment), 0);
}

function timeRange(segment: Segment, i18n: I18n): string {
  return `${formatSeconds(segment.startSeconds)} → ${segment.endSeconds !== null ? formatSeconds(segment.endSeconds) : i18n.common.end}`;
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
  let usesLivePageTime = false;
  const pageTime = state.pageInfo?.videoId === segment.videoId ? state.pageInfo.currentTime : null;
  if (pageTime !== null && pageTime !== undefined) {
    elapsed = pageTime - segment.startSeconds;
    usesLivePageTime = true;
  } else if (
    state.playbackState?.currentSegmentId === segment.id
    && typeof state.playbackState.currentTime === 'number'
    && Number.isFinite(state.playbackState.currentTime)
  ) {
    elapsed = state.playbackState.currentTime - segment.startSeconds;
  } else if (
    state.playbackState?.status === 'playing'
    && (!state.playbackState.currentSegmentId || state.playbackState.currentSegmentId === segment.id)
    && Number.isFinite(state.playbackState.startedAt)
  ) {
    elapsed = (Date.now() - state.playbackState.startedAt) / 1000;
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
    animate: !usesLivePageTime && state.playbackState?.status === 'playing' && remaining > 0 && ratio < 1,
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
  const disabled = extra.cursor === 'not-allowed';
  return {
    width: '30px',
    height: '30px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text2)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? '0.35' : '1',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    ...extra,
  };
}

function playbackStatusText(state: AppState, isPlaying: boolean, i18n: I18n): string {
  if (state.playbackState?.status === 'pending') {
    return i18n.playback.starting;
  }

  if (state.playbackState?.status === 'waiting') {
    return i18n.playback.waiting;
  }

  if (state.playbackState?.status === 'paused') {
    return i18n.playback.paused;
  }

  return isPlaying ? i18n.playback.nowPlaying : i18n.playback.ready;
}

function playbackConnectionText(state: AppState, segment: Segment, i18n: I18n): string | null {
  if (!state.playbackState?.tabId) {
    return null;
  }

  const isConnected = state.pageInfo?.isYouTubeVideoPage === true
    && state.pageInfo.videoId === segment.videoId
    && state.pageInfo.currentTime !== null
    && state.pageInfo.currentTime !== undefined;
  return `${i18n.playback.targetTab(state.playbackState.tabId)} · ${isConnected ? i18n.playback.connected : i18n.playback.disconnected}`;
}

function recoveryModeLabel(mode: PlaybackMode | undefined, i18n: I18n): string {
  if (mode === 'shuffle') {
    return i18n.playback.shuffle;
  }

  if (mode === 'repeat') {
    return i18n.playback.repeatMode;
  }

  return i18n.playback.sequenceMode;
}

function recoveryQueueLabel(recovery: PlaybackRecoveryAction, sequence: Sequence | null, i18n: I18n): string {
  if (recovery.type !== 'start') {
    return '';
  }

  const orderedCount = recovery.orderSegmentIds?.length ?? 0;
  if (recovery.queueEdited) {
    return i18n.playback.recoveryEditedQueue(orderedCount || sequence?.segments.length || 0);
  }

  if (orderedCount > 0) {
    return i18n.playback.recoverySessionQueue(orderedCount);
  }

  return i18n.playback.recoverySavedQueue;
}

function recoverySummary(state: AppState, i18n: I18n): string | null {
  const recovery = state.playbackNotice?.recovery;
  if (!recovery) {
    return null;
  }

  if (recovery.type === 'next') {
    return i18n.playback.recoveryNextSummary;
  }

  if (recovery.type === 'stop') {
    return i18n.playback.recoveryStopSummary;
  }

  const sequence = state.store?.sequences.find((item) => item.id === recovery.sequenceId) ?? null;
  const tapeName = sequence?.name?.trim() || i18n.common.unnamedMixtape;
  return i18n.playback.recoveryStartSummary(
    tapeName,
    recoveryModeLabel(recovery.mode, i18n),
    recoveryQueueLabel(recovery, sequence, i18n)
  );
}

function seekTimeFromPointer(event: MouseEvent, segment: Segment, duration: number): number {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const width = rect.width > 0 ? rect.width : 1;
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / width));
  return segment.startSeconds + (duration * ratio);
}

function seekTimeFromKey(key: string, segment: Segment, currentElapsed: number, duration: number): number | null {
  if (key === 'Home') {
    return segment.startSeconds;
  }
  if (key === 'End') {
    return segment.startSeconds + duration;
  }
  if (key === 'ArrowLeft') {
    return segment.startSeconds + Math.max(0, currentElapsed - 1);
  }
  if (key === 'ArrowRight') {
    return segment.startSeconds + Math.min(duration, currentElapsed + 1);
  }

  return null;
}

function playbackOrderPosition(state: AppState, sequence: Sequence, index: number): number {
  const playbackState = state.playbackState;
  if (playbackState?.sequenceId !== sequence.id) {
    return index;
  }

  if (Number.isInteger(playbackState.orderPosition) && playbackState.orderPosition !== undefined) {
    return playbackState.orderPosition;
  }

  if (playbackState.orderSegmentIds && playbackState.currentSegmentId) {
    const orderPosition = playbackState.orderSegmentIds.findIndex((segmentId) => segmentId === playbackState.currentSegmentId);
    if (orderPosition >= 0) {
      return orderPosition;
    }
  }

  return index;
}

function playbackOrderCount(state: AppState, sequence: Sequence): number {
  const playbackState = state.playbackState;
  if (playbackState?.sequenceId === sequence.id && playbackState.orderSegmentIds && playbackState.orderSegmentIds.length > 0) {
    return playbackState.orderSegmentIds.length;
  }

  return sequence.segments.length;
}

function orderedSegmentsFromIds(sequence: Sequence, segmentIds: string[], appendMissing: boolean): Segment[] {
  const used = new Set<string>();
  const ordered = segmentIds
    .map((segmentId) => {
      if (used.has(segmentId)) {
        return null;
      }
      const segment = sequence.segments.find((item) => item.id === segmentId) ?? null;
      if (segment) {
        used.add(segment.id);
      }
      return segment;
    })
    .filter((segment): segment is Segment => segment !== null);
  if (!appendMissing) {
    return ordered;
  }

  const missing = sequence.segments.filter((segment) => !used.has(segment.id));
  return [...ordered, ...missing];
}

function playbackQueueSegments(state: AppState, sequence: Sequence): Segment[] {
  const playbackState = state.playbackState;
  if (playbackState?.sequenceId === sequence.id && playbackState.queueEdited && playbackState.orderSegmentIds?.length) {
    return orderedSegmentsFromIds(sequence, playbackState.orderSegmentIds, false);
  }

  return sequence.segments;
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

export function Playback(props: Props): HTMLElement {
  const {
    state,
    onBack,
    onPlay,
    onPlayQueueFrom,
    onPause,
    onResume,
    onStop,
    onNext,
    onSeek,
    onRetryPlayback,
    onEditSequence,
    onEditSegment,
    onBeginQueueEdit,
    onRenameSequence,
    onCancelQueueEdit,
    onSaveQueueEdit,
    onMoveQueueSegment,
    onRemoveQueueSegment,
    onRemovePlaybackQueueSegment,
  } = props;
  const i18n = props.i18n ?? createI18n(state.settings.language);
  const sequence = playbackSequence(state);
  const { segment, index } = currentSegment(state, sequence);
  const playbackStatus = state.playbackState?.status ?? null;
  const isPlaying = playbackStatus === 'playing' || (!playbackStatus && state.playbackDisplay?.canStop === true);
  const isPaused = playbackStatus === 'paused';
  const hasPlaybackSession = state.playbackDisplay?.canStop === true || playbackStatus === 'pending' || playbackStatus === 'waiting' || playbackStatus === 'playing' || playbackStatus === 'paused';
  const progressState = progress(state, segment);
  const recoveryText = recoverySummary(state, i18n);

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
        el('p', { text: i18n.playback.emptyTitle, style: { margin: '0 0 6px', fontSize: '14px', fontWeight: '700', color: 'var(--text)' } }),
        el('p', { text: i18n.playback.emptyCopy, style: { margin: '0', color: 'var(--mute)', fontSize: '12px', lineHeight: '1.5' } })
      )
    );
  }

  const currentMode = modeFromState(state);
  const orderPosition = playbackOrderPosition(state, sequence, index);
  const orderCount = playbackOrderCount(state, sequence);
  const upNextCount = Math.max(0, orderCount - orderPosition - 1);
  const activeOrderIds = state.playbackState?.sequenceId === sequence.id ? state.playbackState.orderSegmentIds ?? [] : [];
  const hasActiveOrder = activeOrderIds.length > 0;
  const previousQueuedIndex = hasActiveOrder
    ? sequence.segments.findIndex((item) => item.id === activeOrderIds[orderPosition - 1])
    : -1;
  const nextQueuedIndex = hasActiveOrder
    ? sequence.segments.findIndex((item) => item.id === activeOrderIds[orderPosition + 1])
    : -1;
  const previousIndex = hasActiveOrder ? previousQueuedIndex : Math.max(0, index - 1);
  const nextIndex = hasActiveOrder ? nextQueuedIndex : Math.min(index + 1, sequence.segments.length - 1);
  const hasPrevious = hasActiveOrder ? previousQueuedIndex >= 0 : index > 0;
  const hasNext = hasActiveOrder ? nextQueuedIndex >= 0 : index < sequence.segments.length - 1;
  const queueEdit = state.queueEdit?.sequenceId === sequence.id ? state.queueEdit : null;
  const isEditingQueue = Boolean(queueEdit);
  const canEditQueue = Boolean(
    state.playbackState?.sequenceId === sequence.id
    && (state.playbackState.status === 'playing' || state.playbackState.status === 'waiting' || state.playbackState.status === 'pending' || state.playbackState.status === 'paused')
  );
  const queueSegments = queueEdit
    ? queueEdit.segmentIds
        .map((segmentId) => sequence.segments.find((item) => item.id === segmentId) ?? null)
        .filter((item): item is Segment => item !== null)
    : playbackQueueSegments(state, sequence);
  const connectionText = playbackConnectionText(state, segment, i18n);

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
        el('button', { ariaLabel: i18n.playback.backToMixtapes, onClick: onBack, style: btnIconStyle() }, Glyph('back', 14)),
        el(
          'div',
          { style: { flex: '1', minWidth: '0' } },
          el('span', {
            text: playbackStatusText(state, isPlaying, i18n),
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
                ariaLabel: i18n.playback.renameMixtape,
                title: i18n.playback.renameMixtape,
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
            el('span', { text: formatSeconds(totalDuration(sequence)) }),
            connectionText ? el('span', { text: '·', style: { color: 'var(--mute2)' } }) : null,
            connectionText ? el('span', { text: connectionText }) : null
          )
        )
      ),
      state.playbackNotice
        ? el(
            'div',
            {
              role: 'status',
              style: {
                margin: '-4px 0 12px',
                padding: '8px 10px',
                border: `1px solid ${state.playbackNotice.kind === 'error' ? 'var(--rec)' : 'var(--accent)'}`,
                background: 'var(--surface2)',
                color: state.playbackNotice.kind === 'error' ? 'var(--rec)' : 'var(--accent2)',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '600',
                lineHeight: '1.35',
                display: 'grid',
                gap: '8px',
              },
            },
            el('div', { text: state.playbackNotice.message }),
            recoveryText
              ? el('div', {
                  text: recoveryText,
                  style: {
                    color: 'var(--text2)',
                    fontSize: '10px',
                    fontWeight: '600',
                    lineHeight: '1.35',
                  },
                })
              : null,
            el(
              'div',
              { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' } },
              state.playbackNotice.recovery
                ? el('button', {
                    text: i18n.playback.reconnect,
                    ariaLabel: i18n.playback.reconnectAria,
                    onClick: () => onRetryPlayback?.(),
                    style: {
                      height: '26px',
                      padding: '0 10px',
                      border: '1px solid var(--accent)',
                      background: 'var(--accent)',
                      color: 'var(--accent-ink)',
                      borderRadius: '6px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: onRetryPlayback ? 'pointer' : 'default',
                    },
                  })
                : null,
              el('button', {
                text: i18n.playback.stop,
                ariaLabel: i18n.playback.stopRecoveryAria,
                onClick: onStop,
                style: {
                  height: '26px',
                  padding: '0 10px',
                  border: '1px solid var(--hairline2)',
                  background: 'var(--surface)',
                  color: 'var(--text2)',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                },
              })
            )
          )
        : null,
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
              text: timeRange(segment, i18n),
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
            ariaLabel: i18n.playback.progress,
            role: 'slider',
            tabIndex: 0,
            ariaValueMin: '0',
            ariaValueMax: String(Number(progressState.duration.toFixed(2))),
            ariaValueNow: String(Number(progressState.elapsed.toFixed(2))),
            ariaValueText: `${formatSeconds(progressState.elapsed)} / ${formatSeconds(progressState.duration)}`,
            dataset: { progressRatio: String(Number(progressState.ratio.toFixed(4))) },
            onClick: (event) => onSeek?.(seekTimeFromPointer(event, segment, progressState.duration)),
            onKeyDown: (event) => {
              const targetTime = seekTimeFromKey(event.key, segment, progressState.elapsed, progressState.duration);
              if (targetTime === null) {
                return;
              }

              event.preventDefault();
              onSeek?.(targetTime);
            },
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
        el('button', {
          ariaLabel: i18n.playback.shuffle,
          ariaPressed: currentMode === 'shuffle' ? 'true' : 'false',
          onClick: () => onPlay(index, sequence.id, currentMode === 'shuffle' ? 'sequence' : 'shuffle'),
          style: btnIconStyle(currentMode === 'shuffle' ? { color: 'var(--accent)', background: 'var(--accent-soft)' } : {}),
        }, Glyph('shuffle', 14)),
        el('button', {
          ariaLabel: i18n.playback.previous,
          disabled: !hasPrevious,
          onClick: () => hasPrevious && onPlay(previousIndex, sequence.id, currentMode),
          style: btnIconStyle({ width: '32px', height: '32px', cursor: hasPrevious ? 'pointer' : 'not-allowed' }),
        }, Glyph('prev', 16)),
        el(
          'button',
          {
            ariaLabel: isPlaying ? i18n.playback.pause : isPaused ? i18n.playback.resume : i18n.playback.play,
            onClick: () => {
              if (isPlaying) {
                onPause?.();
                return;
              }
              if (isPaused) {
                onResume?.();
                return;
              }
              onPlay(index, sequence.id, currentMode);
            },
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
          ariaLabel: i18n.playback.next,
          disabled: !hasNext,
          onClick: () => hasNext && (hasPlaybackSession ? onNext() : onPlay(nextIndex, sequence.id, currentMode)),
          style: btnIconStyle({ width: '32px', height: '32px', cursor: hasNext ? 'pointer' : 'not-allowed' }),
        }, Glyph('next', 16)),
        el('button', {
          ariaLabel: i18n.playback.stop,
          disabled: !hasPlaybackSession,
          onClick: () => hasPlaybackSession && onStop(),
          style: btnIconStyle({ width: '30px', height: '30px', cursor: hasPlaybackSession ? 'pointer' : 'not-allowed' }),
        }, Glyph('x', 14)),
        el('button', {
          ariaLabel: i18n.playback.repeatCurrent,
          ariaPressed: currentMode === 'repeat' ? 'true' : 'false',
          onClick: () => onPlay(index, sequence.id, currentMode === 'repeat' ? 'sequence' : 'repeat'),
          style: btnIconStyle(currentMode === 'repeat' ? { color: 'var(--accent)', background: 'var(--accent-soft)' } : {}),
        }, Glyph('repeat', 14))
      )
    ),
    el(
      'div',
      { style: { padding: '14px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      el('span', {
        text: i18n.playback.queue,
        style: { fontFamily: 'JetBrains Mono', fontSize: '11px', fontWeight: '600', color: 'var(--text)', letterSpacing: '0.6px' },
      }),
      isEditingQueue
        ? el('span', {
            text: i18n.playback.editing,
            style: { fontFamily: 'JetBrains Mono', fontSize: '9.5px', color: 'var(--accent)' },
          })
        : el(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            el('span', {
              text: i18n.playback.upNextCount(upNextCount),
              style: { fontFamily: 'JetBrains Mono', fontSize: '9.5px', color: 'var(--mute)' },
            }),
            el('button', {
              text: i18n.playback.editQueue,
              ariaLabel: i18n.playback.editQueue,
              disabled: !canEditQueue,
              ariaDisabled: canEditQueue ? 'false' : 'true',
              onClick: () => canEditQueue && onBeginQueueEdit(sequence.id),
              style: {
                border: '1px solid var(--hairline2)',
                background: 'var(--surface2)',
                color: 'var(--text2)',
                opacity: canEditQueue ? '1' : '0.4',
                height: '26px',
                padding: '0 10px',
                borderRadius: '6px',
                fontSize: '10.5px',
                fontWeight: '600',
                cursor: canEditQueue ? 'pointer' : 'not-allowed',
              },
            }),
            el('button', {
              text: i18n.playback.edit,
              ariaLabel: i18n.playback.editMixtape,
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
          )
    ),
    el(
      'div',
      {
        dataset: { scrollKey: `playback-queue:${sequence.id}` },
        style: { flex: '1', overflow: 'auto', padding: '0 8px 8px', minHeight: '0' },
      },
      ...queueSegments.map((queueSegment, queueIndex) => {
        const originalIndex = sequence.segments.findIndex((item) => item.id === queueSegment.id);
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
                event.dataTransfer?.setData('text/plain', String(queueIndex));
              },
              onDragOver: (event) => event.preventDefault(),
              onDrop: (event) => {
                event.preventDefault();
                const transferIndex = Number(event.dataTransfer?.getData('text/plain'));
                const fromIndex = Number.isInteger(transferIndex) ? transferIndex : -1;
                if (fromIndex >= 0 && fromIndex !== queueIndex) {
                  onMoveQueueSegment(fromIndex, queueIndex);
                }
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
                text: timeRange(queueSegment, i18n),
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
                ariaLabel: i18n.playback.moveUp(queueSegment.title),
                disabled: !canMoveUp,
                onClick: () => canMoveUp && onMoveQueueSegment(queueIndex, queueIndex - 1),
                style: queueActionButtonStyle(!canMoveUp),
              }, Glyph('up', 12)),
              el('button', {
                ariaLabel: i18n.playback.moveDown(queueSegment.title),
                disabled: !canMoveDown,
                onClick: () => canMoveDown && onMoveQueueSegment(queueIndex, queueIndex + 1),
                style: queueActionButtonStyle(!canMoveDown),
              }, Glyph('down', 12)),
              el('button', {
                ariaLabel: i18n.playback.removeFromQueue(queueSegment.title),
                disabled: !canRemove,
                onClick: () => canRemove && onRemoveQueueSegment(queueSegment.id),
                style: queueActionButtonStyle(!canRemove),
              }, Glyph('x', 12))
            )
          );
        }

        return el(
          'div',
          {
            style: {
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0',
              background: now ? 'var(--accent-soft)' : 'transparent',
              borderRadius: '6px',
              borderLeft: now ? '2px solid var(--accent)' : '2px solid transparent',
            },
          },
          el(
            'button',
            {
              ariaLabel: i18n.playback.playFromHere(queueSegment.title),
              onClick: () => {
                const queueSegmentIds = queueSegments.slice(queueIndex).map((item) => item.id);
                if (onPlayQueueFrom && queueSegmentIds.length > 0) {
                  onPlayQueueFrom(sequence.id, queueSegment.id, queueSegmentIds);
                  return;
                }

                onPlay(originalIndex, sequence.id, 'sequence');
              },
              style: {
                flex: '1',
                minWidth: '0',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 8px',
                background: 'transparent',
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
            thumbStyle(Thumb({ themeKey: state.settings.accentKey, videoId: queueSegment.videoId, variant: originalIndex }), 40, 40),
            el(
              'div',
              { style: { flex: '1', minWidth: '0' } },
              el('div', {
                text: queueSegment.title,
                style: {
                  fontSize: '12px',
                  fontWeight: now ? '600' : '500',
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }),
              el('div', {
                text: timeRange(queueSegment, i18n),
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
          ),
          el('button', {
            ariaLabel: i18n.playback.repeatSegment(queueSegment.title),
            title: i18n.playback.repeatSegment(queueSegment.title),
            onClick: () => onPlay(originalIndex, sequence.id, 'repeat'),
            style: queueActionButtonStyle(false),
          }, Glyph('repeat', 12)),
          el('button', {
            ariaLabel: i18n.playback.editSegment(queueSegment.title),
            title: i18n.playback.editSegment(queueSegment.title),
            onClick: () => onEditSegment?.(sequence.id, queueSegment.id),
            style: queueActionButtonStyle(!onEditSegment),
            disabled: !onEditSegment,
          }, Glyph('edit', 12)),
          el('button', {
            ariaLabel: i18n.playback.removeFromQueue(queueSegment.title),
            title: i18n.playback.removeFromQueue(queueSegment.title),
            disabled: now || !onRemovePlaybackQueueSegment,
            onClick: () => !now && onRemovePlaybackQueueSegment?.(queueSegment.id),
            style: queueActionButtonStyle(now || !onRemovePlaybackQueueSegment),
          }, Glyph('x', 12))
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
          el('button', { text: i18n.playback.cancel, ariaLabel: i18n.playback.cancelQueueEdit, onClick: onCancelQueueEdit, style: editTextButtonStyle() }),
          el('button', { text: i18n.playback.done, ariaLabel: i18n.playback.saveQueueEdit, onClick: onSaveQueueEdit, style: editTextButtonStyle(true) })
        )
      : null
  );
}
