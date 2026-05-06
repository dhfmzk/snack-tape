import { Thumb } from '../components/Thumb.js';
import { el } from '../components/dom.js';
import { Glyph } from '../components/Glyph.js';
import { createI18n, type I18n } from '../i18n.js';
import { formatSeconds } from '../shared/time.js';
import type { Sequence } from '../shared/types.js';
import type { AppState } from '../state/store.js';

type Props = {
  state: AppState;
  i18n?: I18n;
  onCreate: () => void;
  onOpenSequence: (sequenceId: string) => void;
  onPlaySequence: (sequenceId: string) => void;
};

type Style = Partial<CSSStyleDeclaration>;

function totalDuration(sequence: Sequence): number {
  return sequence.segments.reduce((sum, segment) => {
    if (!segment.endSeconds || segment.endSeconds <= segment.startSeconds) {
      return sum;
    }

    return sum + (segment.endSeconds - segment.startSeconds);
  }, 0);
}

function coverSegments(sequence: Sequence) {
  if (sequence.segments.length === 0) {
    return [null, null, null, null];
  }

  return [
    sequence.segments[0] ?? null,
    sequence.segments[1] ?? sequence.segments[0] ?? null,
    sequence.segments[2] ?? sequence.segments[0] ?? null,
    sequence.segments[3] ?? sequence.segments[0] ?? null,
  ];
}

function coverThumb(state: AppState, videoId: string | null | undefined, variant: number): HTMLElement {
  const thumb = Thumb({ themeKey: state.settings.accentKey, videoId, variant });
  Object.assign(thumb.style, {
    width: '100%',
    height: '100%',
    borderRadius: '4px',
  } satisfies Style);
  return thumb;
}

function MixtapeCover(state: AppState, sequence: Sequence, index: number): HTMLElement {
  const [first, second, third, fourth] = coverSegments(sequence);

  return el(
    'div',
    {
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr',
        gap: '1px',
        background: 'var(--hairline)',
        height: '110px',
      },
    },
    coverThumb(state, first?.videoId, index * 4),
    el(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateRows: '1fr 1fr',
          gap: '1px',
          background: 'var(--hairline)',
        },
      },
      coverThumb(state, second?.videoId, index * 4 + 1),
      coverThumb(state, third?.videoId, index * 4 + 2)
    ),
    coverThumb(state, fourth?.videoId, index * 4 + 3)
  );
}

function chipStyle(): Style {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: '18px',
    padding: '0 8px',
    border: '1px solid var(--hairline2)',
    fontSize: '9px',
    fontFamily: 'JetBrains Mono',
    color: 'var(--text2)',
    borderRadius: '9px',
    background: 'var(--surface2)',
    letterSpacing: '0.3px',
  };
}

function MixtapeCard(
  state: AppState,
  i18n: I18n,
  sequence: Sequence,
  index: number,
  onOpenSequence: (sequenceId: string) => void,
  onPlaySequence: (sequenceId: string) => void
): HTMLElement {
  const clipCount = sequence.segments.length;
  const duration = totalDuration(sequence);

  return el(
    'div',
    {
      onClick: () => onOpenSequence(sequence.id),
      style: {
        background: 'var(--surface)',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid var(--hairline)',
        cursor: 'pointer',
        flexShrink: '0',
      },
    },
    MixtapeCover(state, sequence, index),
    el(
      'div',
      { style: { padding: '12px 14px 14px' } },
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '8px',
          },
        },
        el('span', {
          text: sequence.name,
          style: {
            fontSize: '14.5px',
            fontWeight: '650',
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: '1',
          },
        }),
        el('span', {
          text: formatSeconds(duration),
          style: {
            fontFamily: 'JetBrains Mono',
            fontSize: '10.5px',
            color: 'var(--mute)',
          },
        })
      ),
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          },
        },
        el(
          'div',
          {
            style: {
              display: 'flex',
              gap: '5px',
              overflow: 'hidden',
              flex: '1',
            },
          },
          el('span', { text: i18n.home.clipCount(clipCount), style: chipStyle() })
        ),
        el(
          'button',
          {
            disabled: clipCount === 0,
            ariaLabel: i18n.home.playAria(sequence.name),
            onClick: (event) => {
              event.stopPropagation();
              onPlaySequence(sequence.id);
            },
            style: {
              width: '32px',
              height: '32px',
              background: 'var(--surface3)',
              color: 'var(--accent)',
              borderRadius: '16px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: clipCount === 0 ? 'not-allowed' : 'pointer',
              opacity: clipCount === 0 ? '0.35' : '1',
              flexShrink: '0',
            },
          },
          Glyph('play', 11)
        )
      )
    )
  );
}

function newTapeButton(i18n: I18n, onCreate: () => void): HTMLButtonElement {
  return el(
    'button',
    {
      ariaLabel: i18n.home.newTapeAria,
      onClick: onCreate,
      style: {
        height: '28px',
        padding: '0 10px',
        fontSize: '11.5px',
        gap: '4px',
        background: 'var(--accent)',
        color: 'var(--accent-ink)',
        border: 'none',
        borderRadius: '6px',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        boxShadow: 'none',
        whiteSpace: 'nowrap',
      },
    },
    Glyph('plus', 11),
    i18n.home.newTape
  );
}

function MixtapeList(children: HTMLElement[]): HTMLElement {
  return el(
    'div',
    {
      dataset: { scrollKey: 'home-mixtapes' },
      style: {
        flex: '1',
        minHeight: '0',
        overflow: 'auto',
        padding: '6px 14px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      },
    },
    ...children
  );
}

export function Home({ state, i18n = createI18n(state.settings.language), onCreate, onOpenSequence, onPlaySequence }: Props): HTMLElement {
  const sequences = state.store?.sequences ?? [];

  return el(
    'div',
    { style: { flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '0' } },
    el(
      'div',
      {
        style: {
          padding: '14px 14px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      },
      el('span', {
        text: i18n.home.title,
        style: {
          fontSize: '18px',
          fontWeight: '700',
          color: 'var(--text)',
          letterSpacing: '-0.4px',
        },
      }),
      newTapeButton(i18n, onCreate)
    ),
    sequences.length === 0
      ? MixtapeList([
          el(
            'section',
            {
              style: {
                background: 'var(--surface)',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid var(--hairline)',
                padding: '18px',
              },
            },
            el('p', {
              text: i18n.home.emptyTitle,
              style: { margin: '0', fontSize: '14px', fontWeight: '700', color: 'var(--text)' },
            })
          ),
        ])
      : MixtapeList(sequences.map((sequence, index) => MixtapeCard(state, i18n, sequence, index, onOpenSequence, onPlaySequence)))
  );
}
