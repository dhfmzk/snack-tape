import { parseYouTubeVideoId } from './youtube.js';

export type PlaybackTabCandidate = {
  id?: number;
  url?: string;
};

export function isExtensionPageUrl(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('chrome-extension://');
}

export function findYouTubePlaybackTab(tabs: PlaybackTabCandidate[]): number | null {
  for (const tab of tabs) {
    if (tab.id !== undefined && !isExtensionPageUrl(tab.url) && tab.url && parseYouTubeVideoId(tab.url)) {
      return tab.id;
    }
  }

  return null;
}
