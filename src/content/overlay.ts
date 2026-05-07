import { createI18n, type Language } from '../i18n.js';
import { isThemeKey, THEMES, type ThemeKey } from '../theme/tokens.js';

const OVERLAY_ID = 'snacktape-continue-overlay';

export type ContinueOverlayOptions = {
  language?: Language;
  accentKey?: ThemeKey;
};

export function removeContinueOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

export function showContinueOverlay(onContinue: () => Promise<void>, options: ContinueOverlayOptions = {}): void {
  removeContinueOverlay();
  const copy = createI18n(options.language).content;
  const theme = THEMES[isThemeKey(options.accentKey) ? options.accentKey : 'peach'];

  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.style.position = 'fixed';
  root.style.right = '20px';
  root.style.bottom = '24px';
  root.style.zIndex = '2147483647';
  root.style.padding = '10px 12px';
  root.style.borderRadius = '8px';
  root.style.background = theme.surface;
  root.style.border = `1px solid ${theme.hairline2}`;
  root.style.boxShadow = `0 8px 24px ${theme.accentGlow}`;
  root.style.color = theme.text;
  root.style.font = '13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

  const label = document.createElement('div');
  label.textContent = copy.continuePrompt;
  label.style.marginBottom = '8px';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = copy.continueButton;
  button.style.border = '0';
  button.style.borderRadius = '6px';
  button.style.padding = '8px 10px';
  button.style.background = theme.accent;
  button.style.color = theme.accentInk;
  button.style.fontWeight = '700';
  button.style.cursor = 'pointer';
  button.addEventListener('click', () => {
    onContinue().catch(() => {
      label.textContent = copy.retryPrompt;
      button.textContent = copy.retryButton;
    });
  });

  root.append(label, button);
  document.documentElement.append(root);
}
