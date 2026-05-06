import { el } from '../components/dom.js';

export function Detail(): HTMLElement {
  return el(
    'div',
    { className: 'screen', dataset: { scrollKey: 'detail-screen' } },
    el(
      'section',
      { className: 'empty-card' },
      el('p', { className: 'empty-title', text: '상세 편집은 M2 범위입니다' }),
      el('p', { className: 'empty-copy', text: '클립 제목, 메모, 태그, 미세 조정은 다음 단계에서 붙입니다.' })
    )
  );
}
