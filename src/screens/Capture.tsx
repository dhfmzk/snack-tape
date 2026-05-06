import { Thumb } from '../components/Thumb.js';
import { el } from '../components/dom.js';
import { Glyph } from '../components/Glyph.js';
import { formatTimecode } from '../shared/time.js';
import type { Segment, Sequence } from '../shared/types.js';
import type { AppState, SegmentEditEdge } from '../state/store.js';

type Props = {
  state: AppState;
  onIn: () => void;
  onOut: () => void;
  onNudgeDraft?: (deltaSeconds: number) => void;
  onTargetSequence?: (sequenceId: string) => void;
  onBeginSegmentEdit?: (segmentId: string) => void;
  onCancelSegmentEdit?: () => void;
  onNudgeSegment?: (segmentId: string, edge: SegmentEditEdge, deltaSeconds: number) => void;
  onDeleteSegment?: (segmentId: string) => void;
  onBeginRenameMixtape?: (sequenceId: string) => void;
  onCancelRenameMixtape?: () => void;
  onRenameMixtape?: (sequenceId: string, name: string) => void;
  onDeleteMixtape?: (sequenceId: string) => void;
};

type Style = Partial<CSSStyleDeclaration>;

function selectedSequence(state: AppState): Sequence | null {
  const sequences = state.store?.sequences ?? [];
  return sequences.find((sequence) => sequence.id === state.store?.selectedSequenceId) ?? sequences[0] ?? null;
}

function editableSegments(sequence: Sequence | null): Segment[] {
  return sequence ? sequence.segments.slice().reverse() : [];
}

function clipDuration(segment: Segment): string {
  if (!segment.endSeconds || segment.endSeconds <= segment.startSeconds) {
    return '0:00.00';
  }

  return formatTimecode(segment.endSeconds - segment.startSeconds);
}

function thumbStyle(thumb: HTMLElement, width: number, height: number): HTMLElement {
  Object.assign(thumb.style, {
    width: `${width}px`,
    height: `${height}px`,
    flexShrink: '0',
    borderRadius: '4px',
  } satisfies Style);
  return thumb;
}

function btnIconStyle(): Style {
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
  };
}

function menuButtonStyle(danger = false): Style {
  return {
    width: '100%',
    height: '32px',
    border: '0',
    background: 'transparent',
    color: danger ? 'var(--danger)' : 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: '600',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };
}

function SegmentActionMenu(
  segment: Segment,
  onBeginSegmentEdit?: (segmentId: string) => void,
  onDeleteSegment?: (segmentId: string) => void
): HTMLElement {
  return el(
    'details',
    {
      className: 'segment-action-menu',
      dataset: { disclosureKey: `segment-actions:${segment.id}` },
      style: {
        position: 'relative',
        flexShrink: '0',
      },
    },
    el(
      'summary',
      {
        ariaLabel: `${segment.title} 메뉴`,
        style: {
          ...btnIconStyle(),
          listStyle: 'none',
        },
      },
      Glyph('moreV', 12)
    ),
    el(
      'div',
      {
        role: 'menu',
        style: {
          position: 'absolute',
          zIndex: '20',
          right: '0',
          top: '32px',
          minWidth: '104px',
          padding: '6px',
          border: '1px solid var(--hairline2)',
          background: 'var(--surface2)',
          borderRadius: '8px',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.28)',
        },
      },
      el(
        'button',
        {
          ariaLabel: `${segment.title} 구간 편집`,
          onClick: () => onBeginSegmentEdit?.(segment.id),
          style: menuButtonStyle(),
        },
        Glyph('note', 12),
        '구간 편집'
      ),
      el(
        'button',
        {
          ariaLabel: `${segment.title} 삭제`,
          onClick: () => onDeleteSegment?.(segment.id),
          style: menuButtonStyle(true),
        },
        Glyph('trash', 12),
        '삭제'
      )
    )
  );
}

function segmentEditButtonStyle(): Style {
  return {
    minWidth: '42px',
    height: '24px',
    padding: '0 8px',
    border: '1px solid var(--hairline2)',
    background: 'var(--surface2)',
    color: 'var(--text2)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '10px',
  };
}

function SegmentEditControls(
  segment: Segment,
  onNudgeSegment?: (segmentId: string, edge: SegmentEditEdge, deltaSeconds: number) => void,
  onCancelSegmentEdit?: () => void
): HTMLElement {
  const controls: Array<{ label: string; delta: number }> = [
    { label: '-1s', delta: -1 },
    { label: '-1f', delta: -1 / 30 },
    { label: '+1f', delta: 1 / 30 },
    { label: '+1s', delta: 1 },
  ];

  const row = (label: string, edge: SegmentEditEdge) =>
    el(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
      el('span', {
        text: label,
        style: {
          width: '28px',
          color: 'var(--mute)',
          fontSize: '10px',
          fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        },
      }),
      ...controls.map((control) =>
        el('button', {
          text: control.label,
          ariaLabel: `${segment.title} ${label} ${control.label}`,
          onClick: () => onNudgeSegment?.(segment.id, edge, control.delta),
          style: segmentEditButtonStyle(),
        })
      )
    );

  return el(
    'div',
    {
      style: {
        marginTop: '10px',
        paddingTop: '10px',
        borderTop: '1px solid var(--hairline)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
    },
    el(
      'div',
      { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
      el('span', { text: '구간 편집', style: { color: 'var(--text)', fontSize: '11px', fontWeight: '700' } }),
      el('button', {
        text: '완료',
        ariaLabel: `${segment.title} 편집 완료`,
        onClick: () => onCancelSegmentEdit?.(),
        style: {
          height: '24px',
          padding: '0 10px',
          border: '1px solid var(--accent)',
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '10.5px',
          fontWeight: '700',
        },
      })
    ),
    row('시작', 'start'),
    row('끝', 'end')
  );
}

function SaveTargetBar(
  sequence: Sequence | null,
  sequences: Sequence[],
  onTargetSequence?: (sequenceId: string) => void,
  isRenaming = false,
  onBeginRenameMixtape?: (sequenceId: string) => void,
  onCancelRenameMixtape?: () => void,
  onRenameMixtape?: (sequenceId: string, name: string) => void,
  onDeleteMixtape?: (sequenceId: string) => void
): HTMLElement {
  const nameControl = sequence && isRenaming
    ? RenameTargetEditor(sequence, onCancelRenameMixtape, onRenameMixtape)
    : SaveTargetSelect(sequence, sequences, onTargetSequence);

  return el(
    'div',
    {
      ariaLabel: '저장 위치',
      style: {
        position: 'relative',
        padding: '10px 14px',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--surface)',
        color: 'var(--text2)',
        flexShrink: '0',
      },
    },
    Glyph('tape', 12),
    el('span', {
      text: '저장 위치',
      style: {
        color: 'var(--mute)',
        fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '10px',
      },
    }),
    nameControl,
    sequence && !isRenaming
      ? el(
          'button',
          {
            type: 'button',
            ariaLabel: '선택된 테이프 이름 변경',
            title: '믹스테이프 이름 변경',
            disabled: !onBeginRenameMixtape,
            onClick: () => onBeginRenameMixtape?.(sequence.id),
            style: {
              width: '28px',
              height: '28px',
              border: '1px solid var(--hairline2)',
              background: 'var(--surface2)',
              color: 'var(--text2)',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: onBeginRenameMixtape ? 'pointer' : 'not-allowed',
              opacity: onBeginRenameMixtape ? '1' : '0.45',
              flexShrink: '0',
            },
          },
          Glyph('edit', 12)
        )
      : null,
    sequence
      ? el(
          'button',
          {
            type: 'button',
            ariaLabel: '선택된 테이프 삭제',
            title: '믹스테이프 삭제',
            onClick: () => onDeleteMixtape?.(sequence.id),
            style: {
              width: '28px',
              height: '28px',
              border: '1px solid var(--hairline2)',
              background: 'var(--surface2)',
              color: 'var(--rec)',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: onDeleteMixtape ? 'pointer' : 'default',
              opacity: onDeleteMixtape ? '1' : '0.45',
              flexShrink: '0',
            },
          },
          Glyph('trash', 12)
        )
      : null
  );
}

function SaveTargetSelect(
  sequence: Sequence | null,
  sequences: Sequence[],
  onTargetSequence?: (sequenceId: string) => void
): HTMLElement {
  return el(
    'span',
    {
      style: {
        position: 'relative',
        flex: '1',
        minWidth: '0',
        height: '24px',
        display: 'block',
      },
    },
    el(
      'select',
      {
        ariaLabel: '저장 위치 선택',
        value: sequence?.id ?? '',
        onChange: (event) => {
          const target = event.target as HTMLSelectElement;
          if (target.value) {
            onTargetSequence?.(target.value);
          }
        },
        style: {
          width: '100%',
          height: '24px',
          padding: '0 18px 0 0',
          border: '0',
          outline: '0',
          background: 'transparent',
          color: 'var(--text)',
          cursor: 'pointer',
          appearance: 'none',
          fontSize: '12px',
          fontWeight: '600',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      },
      ...sequences.map((item) => el('option', { value: item.id, selected: item.id === sequence?.id, text: item.name }))
    ),
    el('span', { style: { position: 'absolute', right: '0', top: '6px', color: 'var(--text2)', pointerEvents: 'none' } }, Glyph('chevD', 11))
  );
}

function RenameTargetEditor(
  sequence: Sequence,
  onCancelRenameMixtape?: () => void,
  onRenameMixtape?: (sequenceId: string, name: string) => void
): HTMLElement {
  let saveButton: HTMLButtonElement;
  const commit = (input: HTMLInputElement) => {
    const name = input.value.trim();
    if (name) {
      onRenameMixtape?.(sequence.id, name);
    }
  };
  const input = el('input', {
    ariaLabel: '믹스테이프 이름',
    value: sequence.name,
    onInput: (event) => {
      const target = event.target as HTMLInputElement;
      saveButton.disabled = target.value.trim().length === 0;
    },
    onKeyDown: (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit(input);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRenameMixtape?.();
      }
    },
    style: {
      flex: '1',
      minWidth: '0',
      height: '28px',
      border: '1px solid var(--accent)',
      background: 'var(--surface2)',
      color: 'var(--text)',
      borderRadius: '6px',
      padding: '0 8px',
      outline: '0',
      fontSize: '12px',
      fontWeight: '600',
    },
  });
  saveButton = el(
    'button',
    {
      type: 'button',
      ariaLabel: '믹스테이프 이름 저장',
      onClick: () => commit(input),
      style: {
        width: '28px',
        height: '28px',
        border: '1px solid var(--accent)',
        background: 'var(--accent)',
        color: 'var(--accent-ink)',
        borderRadius: '6px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: '0',
      },
    },
    Glyph('check', 12)
  );

  return el(
    'span',
    {
      style: {
        flex: '1',
        minWidth: '0',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      },
    },
    input,
    saveButton,
    el(
      'button',
      {
        type: 'button',
        ariaLabel: '믹스테이프 이름 변경 취소',
        onClick: () => onCancelRenameMixtape?.(),
        style: {
          width: '28px',
          height: '28px',
          border: '1px solid var(--hairline2)',
          background: 'var(--surface2)',
          color: 'var(--text2)',
          borderRadius: '6px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: '0',
        },
      },
      Glyph('x', 12)
    )
  );
}

export function Capture({
  state,
  onIn,
  onOut,
  onNudgeDraft,
  onTargetSequence,
  onBeginSegmentEdit,
  onCancelSegmentEdit,
  onNudgeSegment,
  onDeleteSegment,
  onBeginRenameMixtape,
  onCancelRenameMixtape,
  onRenameMixtape,
  onDeleteMixtape,
}: Props): HTMLElement {
  const pageInfo = state.pageInfo;
  const usable = Boolean(pageInfo?.isYouTubeVideoPage && pageInfo.videoId && pageInfo.currentTime !== null && pageInfo.currentTime !== undefined);
  const currentTime = pageInfo?.currentTime ?? 0;
  const sequence = selectedSequence(state);
  const segments = editableSegments(sequence);
  const segmentCount = sequence?.segments.length ?? 0;
  const sequences = state.store?.sequences ?? [];
  const draftText = state.draftIn === null ? '—:—' : formatTimecode(state.draftIn);
  const canNudgeDraft = state.draftIn !== null;
  const hasDraftIn = state.draftIn !== null;
  const canCaptureOut = usable && hasDraftIn;
  const nudgeButtons = [
    { label: '-1s', delta: -1 },
    { label: '-1f', delta: -1 / 30 },
    { label: '+1f', delta: 1 / 30 },
    { label: '+1s', delta: 1 },
  ];

  return el(
    'div',
    {
      dataset: { scrollKey: 'capture-screen' },
      style: {
        flex: '1',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '0',
      },
    },
    SaveTargetBar(
      sequence,
      sequences,
      onTargetSequence,
      Boolean(sequence && state.renameEdit?.sequenceId === sequence.id),
      onBeginRenameMixtape,
      onCancelRenameMixtape,
      onRenameMixtape,
      onDeleteMixtape
    ),
    el(
      'div',
      {
        style: {
          padding: '12px 14px',
          borderBottom: '1px solid var(--hairline)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
        },
      },
      thumbStyle(Thumb({ themeKey: state.settings.accentKey, videoId: pageInfo?.videoId, variant: 0 }), 48, 36),
      el(
        'div',
        { style: { flex: '1', minWidth: '0' } },
        el('div', {
          text: usable ? pageInfo?.title || '제목을 읽는 중' : 'YouTube 영상에서 열어주세요',
          style: {
            color: 'var(--text)',
            fontSize: '11.5px',
            fontWeight: '600',
            lineHeight: '1.3',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        }),
        el(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' } },
          el('div', {
            style: {
              width: '7px',
              height: '7px',
              borderRadius: '4px',
              background: usable ? 'var(--rec)' : 'var(--mute2)',
            },
          }),
          el('span', {
            text: usable ? formatTimecode(currentTime) : '--:--.--',
            style: {
              color: 'var(--text2)',
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '9.5px',
            },
          }),
          el('span', { text: '/', style: { color: 'var(--mute2)', fontSize: '9px' } }),
          el('span', {
            text: pageInfo?.duration ? formatTimecode(pageInfo.duration) : '--:--.--',
            style: {
              color: 'var(--mute)',
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '9.5px',
            },
          })
        )
      )
    ),
    el(
      'div',
      { style: { padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
      el(
        'button',
        {
          disabled: !usable,
          onClick: onIn,
          ariaLabel: 'IN 마커 찍기',
          style: {
            height: '76px',
            border: usable ? '1.5px solid var(--accent)' : '1.5px solid var(--hairline2)',
            background: usable ? 'var(--accent-soft)' : 'var(--surface)',
            borderRadius: '10px',
            color: usable ? 'var(--accent2)' : 'var(--text2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            cursor: usable ? 'pointer' : 'not-allowed',
            opacity: usable ? '1' : '0.45',
            position: 'relative',
            boxShadow: usable ? 'inset 0 0 0 1px var(--accent-soft), 0 0 18px var(--accent-glow)' : 'none',
          },
        },
        el(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          Glyph('inMark', 14),
          el('span', {
            text: 'IN · I',
            style: {
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '1px',
            },
          })
        ),
        el('span', {
          text: state.draftIn === null ? '찍기' : formatTimecode(state.draftIn),
          style: {
            color: 'var(--text)',
            fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '14px',
            fontWeight: '500',
          },
        }),
        state.draftIn !== null
          ? el('span', { style: { position: 'absolute', top: '8px', right: '10px', color: 'var(--accent2)' } }, Glyph('check', 11))
          : null
      ),
      el(
        'button',
        {
          disabled: !canCaptureOut,
          onClick: onOut,
          ariaLabel: 'OUT 마커 찍고 추가',
          style: {
            height: '76px',
            border: canCaptureOut ? '1.5px solid var(--accent)' : '1.5px solid var(--hairline2)',
            background: canCaptureOut ? 'var(--accent)' : 'var(--surface2)',
            color: canCaptureOut ? 'var(--accent-ink)' : 'var(--mute)',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            cursor: canCaptureOut ? 'pointer' : 'not-allowed',
            opacity: usable ? (canCaptureOut ? '1' : '0.7') : '0.45',
            boxShadow: canCaptureOut ? '0 0 28px var(--accent-glow)' : 'none',
          },
        },
        el(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          Glyph('outMark', 14),
          el('span', {
            text: 'OUT + 추가 · O',
            style: {
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '1px',
            },
          })
        ),
        el('span', {
          text: usable ? (hasDraftIn ? '지금' : 'IN 먼저') : formatTimecode(currentTime),
          style: {
            fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '14px',
            fontWeight: '700',
          },
        })
      )
    ),
    el(
      'div',
      { style: { padding: '0 14px 14px', display: 'flex', justifyContent: 'center', gap: '6px' } },
      ...nudgeButtons.map(({ label, delta }) =>
        el('button', {
          text: label,
          disabled: !canNudgeDraft,
          onClick: () => onNudgeDraft?.(delta),
          ariaLabel: `${label} 조정`,
          style: {
            minWidth: '50px',
            height: '26px',
            padding: '0 10px',
            border: '1px solid var(--hairline2)',
            background: 'var(--surface2)',
            color: 'var(--text2)',
            borderRadius: '6px',
            cursor: canNudgeDraft ? 'pointer' : 'not-allowed',
            opacity: canNudgeDraft ? '1' : '0.45',
            fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '10.5px',
          },
        })
      )
    ),
    el(
      'div',
      { style: { padding: '4px 14px 8px' } },
      el('span', {
        text: `이번 세션 · ${segmentCount}개 저장됨`,
        style: {
          color: 'var(--mute)',
          fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: '10px',
          letterSpacing: '0.6px',
        },
      })
    ),
    el(
      'div',
      {
        dataset: { scrollKey: `capture-segments:${sequence?.id ?? 'none'}` },
        style: {
          flex: '1',
          overflow: 'auto',
          padding: '0 14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: '0',
        },
      },
      ...segments.map((segment) =>
        {
          const isEditingSegment = state.segmentEdit?.segmentId === segment.id;
          return (
        el(
          'div',
          {
            style: {
              background: 'var(--surface)',
              border: isEditingSegment ? '1.5px solid var(--accent)' : '1px solid var(--hairline)',
              borderRadius: '8px',
              padding: '10px 12px',
            },
          },
          el(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' } },
            el('span', {
              text: segment.title,
              style: {
                flex: '1',
                minWidth: '0',
                color: 'var(--text)',
                fontSize: '12.5px',
                fontWeight: '600',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            }),
            SegmentActionMenu(segment, onBeginSegmentEdit, onDeleteSegment)
          ),
          el(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            el('span', {
              text: formatTimecode(segment.startSeconds),
              style: {
                padding: '2px 6px',
                background: 'var(--surface3)',
                color: 'var(--text2)',
                borderRadius: '3px',
                fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: '10px',
              },
            }),
            el('span', { style: { color: 'var(--mute2)' } }, Glyph('chevR', 9)),
            el('span', {
              text: segment.endSeconds ? formatTimecode(segment.endSeconds) : 'END',
              style: {
                padding: '2px 6px',
                background: 'var(--surface3)',
                color: 'var(--text2)',
                borderRadius: '3px',
                fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: '10px',
              },
            }),
            el('span', {
              text: `+${clipDuration(segment)}`,
              style: {
                marginLeft: 'auto',
                color: 'var(--accent)',
                fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: '9.5px',
                fontWeight: '600',
              },
            })
          ),
          isEditingSegment ? SegmentEditControls(segment, onNudgeSegment, onCancelSegmentEdit) : null
        )
          );
        }
      ),
      state.draftIn !== null
        ? el(
            'div',
            {
              style: {
                border: '1.5px dashed var(--hairline2)',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              },
            },
            el('div', {
              style: {
                width: '6px',
                height: '6px',
                borderRadius: '3px',
                background: 'var(--accent)',
                boxShadow: '0 0 6px var(--accent-glow)',
              },
            }),
            el(
              'div',
              { style: { flex: '1' } },
              el('span', { text: '현재 캡처 중', style: { color: 'var(--text)', fontSize: '11.5px', fontWeight: '600' } }),
              el(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' } },
                el('span', {
                  text: draftText,
                  style: {
                    color: 'var(--accent)',
                    fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: '10px',
                  },
                }),
                el('span', { style: { color: 'var(--mute2)' } }, Glyph('chevR', 9)),
                el('span', {
                  text: '—:—',
                  style: {
                    color: 'var(--mute2)',
                    fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: '10px',
                  },
                })
              )
            )
          )
        : null
    ),
  );
}
