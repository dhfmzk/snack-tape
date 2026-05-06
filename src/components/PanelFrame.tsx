import type { AppRoute } from '../state/store.js';
import { TabBar } from './TabBar.js';
import { el } from './dom.js';

type PanelFrameProps = {
  active: AppRoute;
  children: Node;
  onRoute: (route: AppRoute) => void;
};

export function PanelFrame({ active, children, onRoute }: PanelFrameProps): HTMLElement {
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
    TabBar(active, onRoute)
  );
}
