import { el } from '../components/dom.js';
import { createI18n, type I18n } from '../i18n.js';

export function Detail(i18n: I18n = createI18n()): HTMLElement {
  return el(
    'div',
    { className: 'screen', dataset: { scrollKey: 'detail-screen' } },
    el(
      'section',
      { className: 'empty-card' },
      el('p', { className: 'empty-title', text: i18n.detail.title }),
      el('p', { className: 'empty-copy', text: i18n.detail.copy })
    )
  );
}
