import { Thumb } from '../components/Thumb.js';
import { el } from '../components/dom.js';
import { Glyph } from '../components/Glyph.js';
import { createI18n, type I18n } from '../i18n.js';
import { formatSeconds } from '../shared/time.js';
import type { Sequence } from '../shared/types.js';
import type { AppState, HomeSort } from '../state/store.js';

type Props = {
  state: AppState;
  i18n?: I18n;
  onCreate: () => void;
  onOpenSequence: (sequenceId: string) => void;
  onPlaySequence: (sequenceId: string) => void;
  onEditSequence?: (sequenceId: string) => void;
  onRenameSequence?: (sequenceId: string) => void;
  onDuplicateSequence?: (sequenceId: string) => void;
  onDeleteSequence?: (sequenceId: string) => void;
  onMergeSequence?: (sourceSequenceId: string, targetSequenceId: string) => void;
  onHomeSearch?: (query: string) => void;
  onHomeSort?: (sort: HomeSort) => void;
};

type Style = Partial<CSSStyleDeclaration>;

function totalDuration(sequence: Sequence): number {
  return sequence.segments.reduce((sum, segment) => {
    if (segment.endSeconds === null || segment.endSeconds <= segment.startSeconds) {
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
        height: '124px',
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
    height: '22px',
    padding: '0 10px',
    border: '1px solid var(--hairline2)',
    fontSize: '10px',
    fontFamily: 'JetBrains Mono',
    color: 'var(--text2)',
    borderRadius: '9px',
    background: 'var(--surface2)',
    letterSpacing: '0.3px',
  };
}

function actionButtonStyle(danger = false): Style {
  return {
    width: '100%',
    height: '30px',
    border: '0',
    background: 'transparent',
    color: danger ? 'var(--danger)' : 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: '650',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };
}

function controlShellStyle(): Style {
  return {
    height: '38px',
    boxSizing: 'border-box',
    border: '1px solid var(--hairline2)',
    background: 'var(--surface)',
    color: 'var(--text)',
    borderRadius: '10px',
    outline: '0',
    fontSize: '12px',
  };
}

function MixtapeControls(
  i18n: I18n,
  search: string,
  sort: HomeSort,
  onHomeSearch?: (query: string) => void,
  onHomeSort?: (sort: HomeSort) => void
): HTMLElement {
  const sortOptions: Array<{ value: HomeSort; label: string }> = [
    { value: 'manual', label: i18n.home.sortManual },
    { value: 'updated', label: i18n.home.sortUpdated },
    { value: 'name', label: i18n.home.sortName },
    { value: 'clipCount', label: i18n.home.sortClipCount },
  ];

  return el(
    'div',
    {
      style: {
        padding: '18px 18px 16px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 132px',
        gap: '12px',
      },
    },
    el('input', {
      ariaLabel: i18n.home.search,
      value: search,
      dataset: { persistKey: 'home-mixtape-search' },
      onInput: (event) => onHomeSearch?.((event.target as HTMLInputElement).value),
      style: {
        ...controlShellStyle(),
        minWidth: '0',
        padding: '0 13px',
      },
    }),
    el(
      'select',
      {
        ariaLabel: i18n.home.sort,
        value: sort,
        dataset: { persistKey: 'home-mixtape-sort' },
        onChange: (event) => onHomeSort?.((event.target as HTMLSelectElement).value as HomeSort),
        style: {
          ...controlShellStyle(),
          padding: '0 10px',
          cursor: 'pointer',
        },
      },
      ...sortOptions.map((option) => el('option', { value: option.value, selected: option.value === sort, text: option.label }))
    )
  );
}

function MixtapeActionMenu(
  i18n: I18n,
  sequence: Sequence,
  sequences: Sequence[],
  onEditSequence?: (sequenceId: string) => void,
  onRenameSequence?: (sequenceId: string) => void,
  onDuplicateSequence?: (sequenceId: string) => void,
  onDeleteSequence?: (sequenceId: string) => void,
  onMergeSequence?: (sourceSequenceId: string, targetSequenceId: string) => void
): HTMLElement {
  const mergeTargets = sequences.filter((item) => item.id !== sequence.id);
  let mergeTargetId = mergeTargets[0]?.id ?? '';

  return el(
    'details',
    {
      dataset: { disclosureKey: `home-actions:${sequence.id}` },
      onClick: (event) => event.stopPropagation(),
      style: {
        position: 'relative',
        flexShrink: '0',
      },
    },
    el(
      'summary',
      {
        ariaLabel: i18n.home.menu(sequence.name),
        ariaHasPopup: 'menu',
        style: {
          height: '34px',
          width: '34px',
          border: '1px solid var(--hairline2)',
          background: 'var(--surface2)',
          color: 'var(--text2)',
          borderRadius: '17px',
          listStyle: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
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
          zIndex: '30',
          right: '0',
          top: '38px',
          width: '188px',
          padding: '8px',
          border: '1px solid var(--hairline2)',
          background: 'var(--surface2)',
          borderRadius: '8px',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.28)',
        },
      },
      el('button', { role: 'menuitem', ariaLabel: i18n.home.edit(sequence.name), onClick: () => onEditSequence?.(sequence.id), style: actionButtonStyle() }, Glyph('edit', 12), i18n.home.editAction),
      el('button', { role: 'menuitem', ariaLabel: i18n.home.rename(sequence.name), onClick: () => onRenameSequence?.(sequence.id), style: actionButtonStyle() }, Glyph('note', 12), i18n.home.renameAction),
      el('button', { role: 'menuitem', ariaLabel: i18n.home.duplicate(sequence.name), onClick: () => onDuplicateSequence?.(sequence.id), style: actionButtonStyle() }, Glyph('plus', 12), i18n.home.duplicateAction),
      mergeTargets.length > 0
        ? el(
            'div',
            { style: { padding: '5px 4px 4px', display: 'grid', gap: '6px' } },
            el(
              'select',
              {
                ariaLabel: i18n.home.mergeTarget(sequence.name),
                value: mergeTargetId,
                onChange: (event) => {
                  mergeTargetId = (event.target as HTMLSelectElement).value;
                },
                style: {
                  width: '100%',
                  height: '28px',
                  border: '1px solid var(--hairline2)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                },
              },
              ...mergeTargets.map((item) => el('option', { value: item.id, selected: item.id === mergeTargetId, text: item.name }))
            ),
            el('button', { role: 'menuitem', ariaLabel: i18n.home.merge(sequence.name), onClick: () => mergeTargetId && onMergeSequence?.(sequence.id, mergeTargetId), style: actionButtonStyle() }, Glyph('chevR', 12), i18n.home.mergeAction)
          )
        : null,
      el('button', { role: 'menuitem', ariaLabel: i18n.home.delete(sequence.name), onClick: () => onDeleteSequence?.(sequence.id), style: actionButtonStyle(true) }, Glyph('trash', 12), i18n.home.deleteAction)
    )
  );
}

function MixtapeCard(
  state: AppState,
  i18n: I18n,
  sequence: Sequence,
  sequences: Sequence[],
  index: number,
  onOpenSequence: (sequenceId: string) => void,
  onPlaySequence: (sequenceId: string) => void,
  onEditSequence?: (sequenceId: string) => void,
  onRenameSequence?: (sequenceId: string) => void,
  onDuplicateSequence?: (sequenceId: string) => void,
  onDeleteSequence?: (sequenceId: string) => void,
  onMergeSequence?: (sourceSequenceId: string, targetSequenceId: string) => void
): HTMLElement {
  const clipCount = sequence.segments.length;
  const duration = totalDuration(sequence);

  return el(
    'div',
    {
      onClick: () => onOpenSequence(sequence.id),
      style: {
        background: 'var(--surface)',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--hairline)',
        cursor: 'pointer',
        flexShrink: '0',
      },
    },
    MixtapeCover(state, sequence, index),
    el(
      'div',
      { style: { padding: '18px 20px 20px' } },
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '14px',
            marginBottom: '18px',
          },
        },
        el('span', {
          text: sequence.name,
          style: {
            fontSize: '16px',
            fontWeight: '650',
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: '1',
            lineHeight: '1.25',
          },
        }),
        el(
          'div',
          {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              flexShrink: '0',
            },
          },
          el('span', {
            text: formatSeconds(duration),
            style: {
              fontFamily: 'JetBrains Mono',
              fontSize: '11px',
              color: 'var(--mute)',
            },
          }),
          MixtapeActionMenu(i18n, sequence, sequences, onEditSequence, onRenameSequence, onDuplicateSequence, onDeleteSequence, onMergeSequence)
        )
      ),
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          },
        },
        el(
          'div',
          {
            style: {
              display: 'flex',
              gap: '8px',
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
              width: '40px',
              height: '40px',
              background: 'var(--surface3)',
              color: 'var(--accent)',
              borderRadius: '20px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: clipCount === 0 ? 'not-allowed' : 'pointer',
              opacity: clipCount === 0 ? '0.35' : '1',
              flexShrink: '0',
            },
          },
          Glyph('play', 13)
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
        height: '36px',
        padding: '0 15px',
        position: 'absolute',
        right: '22px',
        bottom: '22px',
        zIndex: '20',
        fontSize: '13px',
        gap: '7px',
        background: 'var(--accent)',
        color: 'var(--accent-ink)',
        border: 'none',
        borderRadius: '10px',
        fontWeight: '700',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        boxShadow: '0 14px 34px rgba(0, 0, 0, 0.32)',
        whiteSpace: 'nowrap',
      },
    },
    Glyph('plus', 13),
    i18n.home.newTape
  );
}

function MixtapeList(children: HTMLElement[], topPadding = false): HTMLElement {
  return el(
    'div',
    {
      dataset: { scrollKey: 'home-mixtapes' },
      style: {
        flex: '1',
        minHeight: '0',
        overflow: 'auto',
        padding: `${topPadding ? '18px' : '0'} 18px 86px`,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      },
    },
    ...children
  );
}

function sequenceMatches(sequence: Sequence, query: string): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    sequence.name,
    ...sequence.segments.map((segment) => segment.title),
  ].join(' ').toLocaleLowerCase();
  return haystack.includes(query);
}

function visibleSequences(sequences: Sequence[], search: string, sort: HomeSort): Sequence[] {
  const query = search.trim().toLocaleLowerCase();
  const visible = sequences.filter((sequence) => sequenceMatches(sequence, query));
  if (sort === 'updated') {
    return visible.slice().sort((left, right) => right.updatedAt - left.updatedAt);
  }
  if (sort === 'name') {
    return visible.slice().sort((left, right) => left.name.localeCompare(right.name));
  }
  if (sort === 'clipCount') {
    return visible.slice().sort((left, right) => right.segments.length - left.segments.length);
  }

  return visible;
}

export function Home({
  state,
  i18n = createI18n(state.settings.language),
  onCreate,
  onOpenSequence,
  onPlaySequence,
  onEditSequence,
  onRenameSequence,
  onDuplicateSequence,
  onDeleteSequence,
  onMergeSequence,
  onHomeSearch,
  onHomeSort,
}: Props): HTMLElement {
  const sequences = state.store?.sequences ?? [];
  const homeSearch = state.homeSearch ?? '';
  const homeSort = state.homeSort ?? 'manual';
  const filteredSequences = visibleSequences(sequences, homeSearch, homeSort);

  return el(
    'div',
    { style: { flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '0', position: 'relative' } },
    sequences.length > 0 ? MixtapeControls(i18n, homeSearch, homeSort, onHomeSearch, onHomeSort) : null,
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
              style: { margin: '0 0 6px', fontSize: '14px', fontWeight: '700', color: 'var(--text)' },
            }),
            el('p', {
              text: i18n.home.emptyCopy,
              style: { margin: '0', color: 'var(--mute)', fontSize: '11px', lineHeight: '1.45' },
            })
          ),
        ], true)
      : MixtapeList(filteredSequences.map((sequence, index) => MixtapeCard(
          state,
          i18n,
          sequence,
          sequences,
          index,
          onOpenSequence,
          onPlaySequence,
          onEditSequence,
          onRenameSequence,
          onDuplicateSequence,
          onDeleteSequence,
          onMergeSequence
        ))),
    newTapeButton(i18n, onCreate)
  );
}
