type CaptureVideoSyncTarget = {
  syncActiveVideoForCapture(): Promise<void>;
};

type EventTargetLike = {
  addEventListener(type: string, listener: () => void): void;
};

type VisibilityDocumentLike = {
  hidden: boolean;
  addEventListener(type: string, listener: () => void): void;
};

function runSync(store: CaptureVideoSyncTarget): void {
  void store.syncActiveVideoForCapture();
}

export function installActiveVideoDetection(
  store: CaptureVideoSyncTarget,
  targetWindow: EventTargetLike = window,
  targetDocument: VisibilityDocumentLike = document
): void {
  const sync = () => runSync(store);

  chrome.tabs?.onActivated?.addListener(sync);
  chrome.tabs?.onUpdated?.addListener((_tabId, changeInfo, tab) => {
    if (!tab.active) {
      return;
    }

    if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
      sync();
    }
  });

  chrome.windows?.onFocusChanged?.addListener((windowId) => {
    if (windowId !== (chrome.windows?.WINDOW_ID_NONE ?? -1)) {
      sync();
    }
  });

  targetDocument.addEventListener('visibilitychange', () => {
    if (!targetDocument.hidden) {
      sync();
    }
  });
  targetWindow.addEventListener('focus', sync);
}
