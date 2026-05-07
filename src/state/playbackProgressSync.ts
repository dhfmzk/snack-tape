type PlaybackProgressSyncTarget = {
  syncPlaybackProgress(): Promise<void>;
};

type Timer = (callback: () => void, intervalMs: number) => number;

export const PLAYBACK_PROGRESS_SYNC_MS = 500;

export function installPlaybackProgressSync(
  store: PlaybackProgressSyncTarget,
  setIntervalFn: Timer = window.setInterval.bind(window)
): void {
  setIntervalFn(() => {
    void store.syncPlaybackProgress();
  }, PLAYBACK_PROGRESS_SYNC_MS);
}
