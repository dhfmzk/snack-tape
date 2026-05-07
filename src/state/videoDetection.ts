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

type ScheduleSync = (callback: () => void) => void;

function defaultSchedule(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
    return;
  }

  window.setTimeout(callback, 0);
}

export function installActiveVideoDetection(
  store: CaptureVideoSyncTarget,
  targetWindow: EventTargetLike = window,
  targetDocument: VisibilityDocumentLike = document,
  schedule: ScheduleSync = defaultSchedule
): void {
  let queued = false;
  const sync = () => {
    if (queued) {
      return;
    }

    queued = true;
    schedule(() => {
      queued = false;
      void store.syncActiveVideoForCapture();
    });
  };

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
