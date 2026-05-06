import { el } from '../components/dom.js';
import { Glyph } from '../components/Glyph.js';
import type { AppState } from '../state/store.js';
import type { Settings as SnackTapeSettings } from '../state/storage.js';
import type { ThemeKey } from '../theme/tokens.js';
import { SNACKTAPE_PALETTE } from '../theme/tokens.js';

type Props = {
  state: AppState;
  onAccent: (key: ThemeKey) => void;
  onSettingChange?: (patch: Partial<SnackTapeSettings>) => void;
};

type RowProps = {
  label: string;
  sub?: string;
  right?: string;
  mono?: boolean;
  chev?: boolean;
  toggle?: boolean;
  on?: boolean;
  danger?: boolean;
  onToggle?: () => void;
};

function selectedMixtapeName(state: AppState): string {
  const sequences = state.store?.sequences ?? [];
  const settingsDefault = state.settings.defaultMixtapeId
    ? sequences.find((sequence) => sequence.id === state.settings.defaultMixtapeId)
    : undefined;
  const selected = state.store?.selectedSequenceId
    ? sequences.find((sequence) => sequence.id === state.store?.selectedSequenceId)
    : undefined;

  return settingsDefault?.name ?? selected?.name ?? sequences[0]?.name ?? '믹스테이프 없음';
}

function SettingsRow({ label, sub, right, mono, chev, toggle, on, danger, onToggle }: RowProps): HTMLElement {
  return el(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        padding: '11px 0',
        borderBottom: '1px solid var(--hairline)',
        gap: '10px',
      },
    },
    el(
      'div',
      { style: { flex: '1', minWidth: '0' } },
      el('div', {
        text: label,
        style: {
          fontSize: '12.5px',
          fontWeight: '500',
          color: danger ? 'var(--rec)' : 'var(--text)',
        },
      }),
      sub
        ? el('div', {
            text: sub,
            style: {
              fontSize: '10.5px',
              color: 'var(--mute)',
              marginTop: '2px',
            },
          })
        : null
    ),
    right && !toggle
      ? el('span', {
          text: right,
          style: {
            fontSize: '11px',
            color: 'var(--text2)',
            fontFamily: mono ? 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : 'inherit',
            padding: mono ? '2px 7px' : '0',
            background: mono ? 'var(--surface3)' : 'transparent',
            borderRadius: '4px',
            letterSpacing: mono ? '0.3px' : '0',
          },
        })
      : null,
    toggle
      ? el(
          'button',
          {
            type: 'button',
            ariaLabel: `${label} ${on ? '끄기' : '켜기'}`,
            onClick: () => onToggle?.(),
            style: {
              width: '32px',
              height: '18px',
              border: '0',
              borderRadius: '9px',
              background: on ? 'var(--accent)' : 'var(--surface3)',
              position: 'relative',
              flexShrink: '0',
              padding: '0',
              cursor: onToggle ? 'pointer' : 'default',
              boxShadow: on ? '0 0 10px var(--accent-glow)' : 'none',
            },
          },
          el('span', {
            style: {
              position: 'absolute',
              top: '2px',
              left: on ? '16px' : '2px',
              width: '14px',
              height: '14px',
              borderRadius: '7px',
              background: on ? 'var(--accent-ink)' : 'var(--text2)',
              transition: 'left .15s',
            },
          })
        )
      : null,
    chev ? el('span', { style: { color: 'var(--mute)' } }, Glyph('chevR', 11)) : null
  );
}

function Section(title: string, ...children: HTMLElement[]): HTMLElement {
  return el(
    'div',
    { style: { marginBottom: '22px' } },
    el('div', {
      text: title,
      style: {
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--text)',
        marginBottom: '10px',
      },
    }),
    ...children
  );
}

export function Settings({ state, onAccent, onSettingChange }: Props): HTMLElement {
  const currentKey = state.settings.accentKey;

  return el(
    'div',
    {
      className: 'screen-settings',
      dataset: { scrollKey: 'settings-screen' },
      style: {
        flex: '1',
        height: '100%',
        overflow: 'auto',
        padding: '14px 14px 20px',
      },
    },
    el('div', {
      text: '설정',
      style: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text)',
        letterSpacing: '0',
        marginBottom: '14px',
      },
    }),
    el(
      'div',
      { style: { marginBottom: '22px' } },
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '4px',
          },
        },
        el('span', {
          text: '포인트 컬러',
          style: {
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text)',
          },
        }),
        el('span', {
          text: currentKey.toUpperCase(),
          style: {
            fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '9.5px',
            color: 'var(--mute)',
            letterSpacing: '0.4px',
          },
        })
      ),
      el('div', {
        text: '현재 재생 / 저장 / 활성 상태에 사용되는 색입니다.',
        style: {
          fontSize: '11px',
          color: 'var(--mute)',
          marginBottom: '12px',
          lineHeight: '1.5',
        },
      }),
      el(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '8px',
          },
        },
        ...SNACKTAPE_PALETTE.map((palette) => {
          const selected = palette.key === currentKey;
          return el(
            'button',
            {
              type: 'button',
              ariaLabel: `${palette.name} 선택`,
              onClick: () => onAccent(palette.key),
              style: {
                background: 'var(--surface)',
                border: `1.5px solid ${selected ? palette.hex : 'var(--hairline)'}`,
                borderRadius: '10px',
                padding: '10px 6px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: selected ? `0 0 16px ${palette.hex}55` : 'none',
                transition: 'all .15s',
              },
            },
            el('div', {
              style: {
                width: '28px',
                height: '28px',
                borderRadius: '14px',
                background: palette.hex,
                boxShadow: `0 0 12px ${palette.hex}66`,
              },
            }),
            el('span', {
              text: palette.key,
              style: {
                fontSize: '9.5px',
                fontWeight: selected ? '600' : '500',
                color: selected ? 'var(--text)' : 'var(--text2)',
                fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                letterSpacing: '0.2px',
              },
            }),
            selected
              ? el(
                  'div',
                  {
                    style: {
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      color: palette.hex,
                    },
                  },
                  Glyph('check', 11)
                )
              : null
          );
        })
      )
    ),
    Section(
      '재생',
      SettingsRow({
        label: '자동 다음 재생',
        sub: '구간 끝나면 다음 클립으로',
        toggle: true,
        on: state.settings.autoNext,
        onToggle: () => onSettingChange?.({ autoNext: !state.settings.autoNext }),
      }),
      SettingsRow({
        label: '구간 끝에서 0.3초 페이드',
        sub: '끊김 부드럽게',
        toggle: true,
        on: state.settings.fadeOut,
        onToggle: () => onSettingChange?.({ fadeOut: !state.settings.fadeOut }),
      }),
      SettingsRow({
        label: '기본 시작 시 셔플',
        toggle: true,
        on: state.settings.shuffleByDefault,
        onToggle: () => onSettingChange?.({ shuffleByDefault: !state.settings.shuffleByDefault }),
      })
    ),
    Section(
      '캡처',
      SettingsRow({ label: '단축키 — IN', right: state.settings.shortcutIn, mono: true }),
      SettingsRow({ label: '단축키 — OUT + 저장', right: state.settings.shortcutOut, mono: true }),
      SettingsRow({ label: '기본 저장 위치', right: selectedMixtapeName(state) }),
      SettingsRow({
        label: 'OUT 시 자동 제목 추론',
        sub: '자막·챕터에서 추출',
        toggle: true,
        on: state.settings.autoTitleFromCaptions,
        onToggle: () => onSettingChange?.({ autoTitleFromCaptions: !state.settings.autoTitleFromCaptions }),
      })
    ),
    Section(
      '데이터',
      SettingsRow({ label: '내보내기', right: 'JSON · CSV', chev: true }),
      SettingsRow({ label: '가져오기', chev: true }),
      SettingsRow({ label: '모든 클립 삭제', danger: true })
    ),
    el(
      'div',
      {
        style: {
          paddingTop: '14px',
          borderTop: '1px solid var(--hairline)',
          fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: '9.5px',
          color: 'var(--mute2)',
          letterSpacing: '0.4px',
          lineHeight: '1.6',
        },
      },
      'SNACKTAPE v0.1.0 · MV3 SIDE PANEL',
      el('br'),
      'BY YOU · 2026'
    )
  );
}
