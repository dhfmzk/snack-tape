const OVERLAY_ID = 'snacktape-continue-overlay';

export function removeContinueOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

export function showContinueOverlay(onContinue: () => Promise<void>): void {
  removeContinueOverlay();

  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.style.position = 'fixed';
  root.style.right = '20px';
  root.style.bottom = '24px';
  root.style.zIndex = '2147483647';
  root.style.padding = '10px 12px';
  root.style.borderRadius = '8px';
  root.style.background = '#202124';
  root.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.28)';
  root.style.color = '#fff';
  root.style.font = '13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

  const label = document.createElement('div');
  label.textContent = 'SnackTape 재생을 계속할까요?';
  label.style.marginBottom = '8px';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '계속 재생';
  button.style.border = '0';
  button.style.borderRadius = '6px';
  button.style.padding = '8px 10px';
  button.style.background = '#f4b400';
  button.style.color = '#202124';
  button.style.fontWeight = '700';
  button.style.cursor = 'pointer';
  button.addEventListener('click', () => {
    onContinue().catch(() => {
      label.textContent = 'YouTube 플레이어를 직접 한 번 클릭한 뒤 다시 시도해주세요.';
      button.textContent = '다시 시도';
    });
  });

  root.append(label, button);
  document.documentElement.append(root);
}
