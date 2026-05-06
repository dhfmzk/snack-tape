import { App } from './App.js';
import { clearAndAppend } from './components/dom.js';
import { createFrameRenderScheduler } from './shared/renderScheduler.js';
import type { SnackTapeMessage } from './shared/types.js';
import { SnackTapeAppStore, type AppState } from './state/store.js';
import { installActiveVideoDetection } from './state/videoDetection.js';
import { applyTheme } from './theme/ThemeProvider.js';
import { THEMES } from './theme/tokens.js';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('SnackTape root element is missing.');
}

const store = new SnackTapeAppStore();

const scheduleRender = createFrameRenderScheduler<AppState>((state) => {
  applyTheme(document.documentElement, THEMES[state.settings.accentKey]);
  clearAndAppend(root, App(state, store));
});

store.subscribe(scheduleRender);
installActiveVideoDetection(store);

chrome.runtime.onMessage.addListener((message: SnackTapeMessage) => {
  if (message.type === 'COMMAND_EVENT') {
    void store.handleCommand(message.name);
  }
});

void store.init();
