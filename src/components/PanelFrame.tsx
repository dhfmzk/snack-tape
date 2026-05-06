import { createI18n, type I18n } from '../i18n.js';
import type { AppRoute } from '../state/store.js';
import { TabBar } from './TabBar.js';
import { el } from './dom.js';

type PanelFrameProps = {
  active: AppRoute;
  children: Node;
  i18n?: I18n;
  onRoute: (route: AppRoute) => void;
};

export function PanelFrame({ active, children, i18n = createI18n(), onRoute }: PanelFrameProps): HTMLElement {
  return el(
    'section',
    {
      className: 'panel-frame',
      style: {
        width: '100%',
        height: '100%',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        WebkitFontSmoothing: 'antialiased',
      } as Partial<CSSStyleDeclaration>,
    },
    el(
      'main',
      {
        className: 'panel-main',
        dataset: { patchKey: `panel-main:${active}` },
        style: { flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '0' },
      },
      children
    ),
    TabBar(active, onRoute, i18n)
  );
}
