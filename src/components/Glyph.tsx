export type GlyphKind =
  | 'play'
  | 'pause'
  | 'next'
  | 'prev'
  | 'shuffle'
  | 'repeat'
  | 'plus'
  | 'search'
  | 'moreV'
  | 'chevR'
  | 'chevD'
  | 'up'
  | 'down'
  | 'back'
  | 'grip'
  | 'inMark'
  | 'outMark'
  | 'check'
  | 'x'
  | 'tape'
  | 'cap'
  | 'note'
  | 'cog'
  | 'trash'
  | 'edit';

const PATHS: Record<GlyphKind, string> = {
  play: '<polygon points="4,2 13,8 4,14" fill="currentColor" stroke="none" />',
  pause: '<g><rect x="3.5" y="2" width="3" height="12" rx="0.5" fill="currentColor" /><rect x="9.5" y="2" width="3" height="12" rx="0.5" fill="currentColor" /></g>',
  next: '<g><polygon points="3,2 11,8 3,14" fill="currentColor" /><rect x="12" y="2" width="2" height="12" rx="0.5" fill="currentColor" /></g>',
  prev: '<g><polygon points="13,2 5,8 13,14" fill="currentColor" /><rect x="2" y="2" width="2" height="12" rx="0.5" fill="currentColor" /></g>',
  shuffle: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,4 5,4 11,12 14,12" /><polyline points="11,4 14,4" /><polyline points="2,12 5,12 7,9.5" /><polyline points="12,2 14,4 12,6" /><polyline points="12,10 14,12 12,14" /></g>',
  repeat: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 13,5 11,3"/><polyline points="13,5 11,7"/><polyline points="13,11 3,11 5,9"/><polyline points="3,11 5,13"/></g>',
  plus: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></g>',
  search: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="7" cy="7" r="4" /><line x1="10" y1="10" x2="13.5" y2="13.5" /></g>',
  moreV: '<g fill="currentColor"><circle cx="8" cy="3" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="8" cy="13" r="1.3" /></g>',
  chevR: '<polyline fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" points="6,3 11,8 6,13" />',
  chevD: '<polyline fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" points="3,6 8,11 13,6" />',
  up: '<polyline fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" points="3,10 8,5 13,10" />',
  down: '<polyline fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" points="3,6 8,11 13,6" />',
  back: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="7,3 2,8 7,13" /><line x1="2" y1="8" x2="14" y2="8" /></g>',
  grip: '<g fill="currentColor"><circle cx="5" cy="4" r="1"/><circle cx="11" cy="4" r="1"/><circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="11" cy="12" r="1"/></g>',
  inMark: '<g><line x1="3.5" y1="2" x2="3.5" y2="14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><polygon points="5,5 9,8 5,11" fill="currentColor"/></g>',
  outMark: '<g><line x1="12.5" y1="2" x2="12.5" y2="14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><polygon points="11,5 7,8 11,11" fill="currentColor"/></g>',
  check: '<polyline fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" points="3,8 7,12 13,4"/>',
  x: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></g>',
  tape: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="4" width="13" height="8" rx="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/></g>',
  cap: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="10" rx="1.5"/><line x1="2" y1="6" x2="14" y2="6"/><circle cx="4" cy="4.5" r="0.5" fill="currentColor"/></g>',
  note: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="10" height="12" /><line x1="5" y1="6" x2="11" y2="6" /><line x1="5" y1="9" x2="11" y2="9" /><line x1="5" y1="12" x2="9" y2="12" /></g>',
  cog: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2L4.6 4.6M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4"/></g>',
  trash: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5,4 13.5,4"/><path d="M5 4V2.5h6V4"/><path d="M3.5 4l1 10h7l1-10"/><line x1="6.5" y1="6.5" x2="6.5" y2="11.5"/><line x1="9.5" y1="6.5" x2="9.5" y2="11.5"/></g>',
  edit: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5V13h1.5L12 5.5 10.5 4 3 11.5z"/><path d="M9.5 5 11 3.5 12.5 5 11 6.5"/></g>',
};

export function Glyph(kind: GlyphKind, size = 14): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = PATHS[kind];
  return svg;
}
