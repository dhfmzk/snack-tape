import type { Theme } from './tokens.js';

function cssName(key: string): string {
  return `--${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}

export function applyTheme(target: HTMLElement, theme: Theme): void {
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'name') {
      continue;
    }

    target.style.setProperty(cssName(key), value);
  }

  target.dataset.themeName = theme.name;
}
