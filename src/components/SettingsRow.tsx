import { el } from './dom.js';
import { Glyph } from './Glyph.js';

type SettingsRowProps = {
  label: string;
  sub?: string;
  right?: string;
  mono?: boolean;
  chev?: boolean;
  toggle?: boolean;
  on?: boolean;
  danger?: boolean;
};

export function SettingsRow({ label, sub, right, mono, chev, toggle, on, danger }: SettingsRowProps): HTMLElement {
  const row = el(
    'div',
    { className: danger ? 'settings-row is-danger' : 'settings-row' },
    el(
      'div',
      { className: 'settings-row-copy' },
      el('span', { className: 'settings-row-label', text: label }),
      sub ? el('span', { className: 'settings-row-sub', text: sub }) : null
    )
  );

  if (right && !toggle) {
    row.append(el('span', { className: mono ? 'settings-chip mono' : 'settings-chip', text: right }));
  }

  if (toggle) {
    row.append(el('span', { className: on ? 'toggle is-on' : 'toggle' }, el('span', { className: 'toggle-knob' })));
  }

  if (chev) {
    row.append(el('span', { className: 'settings-chev' }, Glyph('chevR', 11)));
  }

  return row;
}
