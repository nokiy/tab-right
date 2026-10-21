/**
 * [POS]: The one settings reader — tells "loaded" from "read failed"; used by the placement kernel, the toolbar icon and the popup/options store
 */
import { normalizeSettings, SETTINGS_KEYS } from '../settings';
import type { Settings } from '../types';

// A minimal seam over chrome.storage.local.get, narrowed to what loadSettings needs.
export type SettingsStorageReader = {
  get(keys: string[]): Promise<Record<string, unknown>>;
};

export type SettingsLoadResult =
  | { status: 'loaded'; settings: Settings }
  | { status: 'failed'; error: unknown };

// Reads Settings from storage and reports whether the read actually succeeded.
// A storage error must surface as `failed`, never be swallowed into defaults —
// defaults are only correct when the keys are genuinely absent (first install),
// which normalizeSettings already handles for a successful empty read.
export const loadSettings = async (storage: SettingsStorageReader): Promise<SettingsLoadResult> => {
  try {
    const raw = await storage.get(SETTINGS_KEYS);
    return { status: 'loaded', settings: normalizeSettings(raw) };
  } catch (error) {
    return { status: 'failed', error };
  }
};
