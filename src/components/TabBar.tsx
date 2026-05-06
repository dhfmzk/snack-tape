import { createI18n, type I18n } from '../i18n.js';
import type { AppRoute } from '../state/store.js';
import { el } from './dom.js';
import { Glyph, type GlyphKind } from './Glyph.js';

type Tab = {
  route: AppRoute;
  labelKey: 'capture' | 'home' | 'settings';
  icon: GlyphKind;
};

const TABS: Tab[] = [
  { route: 'capture', labelKey: 'capture', icon: 'cap' },
  { route: 'home', labelKey: 'home', icon: 'tape' },
  { route: 'settings', labelKey: 'settings', icon: 'cog' },
];

export function TabBar(active: AppRoute, onRoute: (route: AppRoute) => void, i18n: I18n = createI18n()): HTMLElement {
  return el(
    'nav',
    {
      className: 'tabbar',
      role: 'tablist',
      ariaLabel: i18n.tabs.aria,
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
      const label = i18n.tabs[tab.labelKey];
      const button = el(
        'button',
        {
          className: selected ? 'tab is-active' : 'tab',
          role: 'tab',
          ariaLabel: label,
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
          text: label,
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
