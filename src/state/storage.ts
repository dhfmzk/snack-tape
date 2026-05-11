import { isLanguage, type Language } from '../i18n.js';
import { isThemeKey, type ThemeKey } from '../theme/tokens.js';

export type Settings = {
  accentKey: ThemeKey;
  language: Language;
  autoNext: boolean;
  fadeOut: boolean;
  shuffleByDefault: boolean;
  shortcutIn: string;
  shortcutOut: string;
  defaultMixtapeId?: string;
  autoTitleFromCaptions: boolean;
};

export const SETTINGS_KEY = 'snacktape.settings.v1';
export const COMMAND_SHORTCUTS = {
  captureIn: 'Alt+I',
  captureOut: 'Alt+O',
} as const;

export const DEFAULT_SETTINGS: Settings = {
  accentKey: 'peach',
  language: 'ko',
  autoNext: true,
  fadeOut: true,
  shuffleByDefault: false,
  shortcutIn: COMMAND_SHORTCUTS.captureIn,
  shortcutOut: COMMAND_SHORTCUTS.captureOut,
  autoTitleFromCaptions: true,
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeSettings(input: unknown): Settings {
  if (!isRecord(input)) {
    return { ...DEFAULT_SETTINGS };
  }

  const defaultMixtapeId = typeof input.defaultMixtapeId === 'string' ? input.defaultMixtapeId : undefined;

  return {
    accentKey: isThemeKey(input.accentKey) ? input.accentKey : DEFAULT_SETTINGS.accentKey,
    language: isLanguage(input.language) ? input.language : DEFAULT_SETTINGS.language,
    autoNext: bool(input.autoNext, DEFAULT_SETTINGS.autoNext),
    fadeOut: bool(input.fadeOut, DEFAULT_SETTINGS.fadeOut),
    shuffleByDefault: bool(input.shuffleByDefault, DEFAULT_SETTINGS.shuffleByDefault),
    shortcutIn: DEFAULT_SETTINGS.shortcutIn,
    shortcutOut: DEFAULT_SETTINGS.shortcutOut,
    autoTitleFromCaptions: bool(input.autoTitleFromCaptions, DEFAULT_SETTINGS.autoTitleFromCaptions),
    ...(defaultMixtapeId ? { defaultMixtapeId } : {}),
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
