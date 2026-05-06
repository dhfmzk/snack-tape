import { isThemeKey, type ThemeKey } from '../theme/tokens.js';

export type Settings = {
  accentKey: ThemeKey;
  autoNext: boolean;
  fadeOut: boolean;
  shuffleByDefault: boolean;
  shortcutIn: string;
  shortcutOut: string;
  defaultMixtapeId?: string;
  autoTitleFromCaptions: boolean;
};

export const SETTINGS_KEY = 'snacktape.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  accentKey: 'peach',
  autoNext: true,
  fadeOut: true,
  shuffleByDefault: false,
  shortcutIn: 'I',
  shortcutOut: 'O',
  autoTitleFromCaptions: true,
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function normalizeSettings(input: unknown): Settings {
  if (!isRecord(input)) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    accentKey: isThemeKey(input.accentKey) ? input.accentKey : DEFAULT_SETTINGS.accentKey,
    autoNext: bool(input.autoNext, DEFAULT_SETTINGS.autoNext),
    fadeOut: bool(input.fadeOut, DEFAULT_SETTINGS.fadeOut),
    shuffleByDefault: bool(input.shuffleByDefault, DEFAULT_SETTINGS.shuffleByDefault),
    shortcutIn: text(input.shortcutIn, DEFAULT_SETTINGS.shortcutIn),
    shortcutOut: text(input.shortcutOut, DEFAULT_SETTINGS.shortcutOut),
    defaultMixtapeId: typeof input.defaultMixtapeId === 'string' ? input.defaultMixtapeId : undefined,
    autoTitleFromCaptions: bool(input.autoTitleFromCaptions, DEFAULT_SETTINGS.autoTitleFromCaptions),
  };
}

function storageGet(key: string): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key]);
    });
  });
}

function storageSet(value: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

export async function loadSettings(): Promise<Settings> {
  const raw = await storageGet(SETTINGS_KEY);
  const settings = normalizeSettings(raw);

  if (!raw) {
    await saveSettings(settings);
  }

  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await storageSet({
    [SETTINGS_KEY]: normalizeSettings(settings),
  });
}
