import type { AppRoute } from '../state/store.js';
import { el } from './dom.js';
import { Glyph, type GlyphKind } from './Glyph.js';

type Tab = {
  route: AppRoute;
  label: string;
  icon: GlyphKind;
};

const TABS: Tab[] = [
  { route: 'capture', label: '편집', icon: 'cap' },
  { route: 'home', label: '믹스테이프', icon: 'tape' },
  { route: 'settings', label: '설정', icon: 'cog' },
];

export function TabBar(active: AppRoute, onRoute: (route: AppRoute) => void): HTMLElement {
  return el(
    'nav',
    {
      className: 'tabbar',
      role: 'tablist',
      ariaLabel: 'SnackTape 화면',
      dataset: { patchKey: `tabbar:${active}` },
      style: {
        display: 'flex',
        borderTop: '1px solid var(--hairline)',
        height: '54px',
        background: 'var(--surface)',
        flexShrink: '0',
      },
    },
    ...TABS.map((tab) => {
      const selected = active === tab.route || (active === 'playback' && tab.route === 'home');
      const button = el(
        'button',
        {
          className: selected ? 'tab is-active' : 'tab',
          role: 'tab',
          ariaLabel: tab.label,
          onClick: () => onRoute(tab.route),
          style: {
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: selected ? 'var(--accent)' : 'var(--mute)',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
          },
        },
        Glyph(tab.icon, 16),
        el('span', {
          text: tab.label,
          style: {
            fontSize: '9.5px',
            fontWeight: selected ? '600' : '500',
            letterSpacing: '0.2px',
          },
        })
      );
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      return button;
    })
  );
}
