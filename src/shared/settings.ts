/**
 * [POS]: The one settings contract shared by background and UI — defaults, normalisation, and turning a storage change into a patch
 */
import type { Settings } from './types';

export const SETTINGS_DEFAULTS: Settings = {
  enabled: true,
  pause_until: null,
};

export const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS) as Array<keyof Settings>;

// Untrusted settings fields as storage returns them: present keys only, any value.
export type SettingsPatch = { readonly [K in keyof Settings]?: unknown };

// Normalizes whatever chrome.storage.local returns into a valid Settings value.
// Absent or malformed fields fall back to defaults; this is also what makes a
// first-install read (no keys yet) resolve to the default enabled/running state.
export const normalizeSettings = (raw: SettingsPatch | null | undefined): Settings => {
  const source = raw ?? {};

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : SETTINGS_DEFAULTS.enabled,
    pause_until: typeof source.pause_until === 'number' ? source.pause_until : null,
  };
};

// Keeps only the settings fields of a chrome.storage change, as their new values.
// Null when the change touched no settings field (e.g. a debug log write).
export const settingsPatchOf = (changes: Readonly<Record<string, { newValue?: unknown }>>): SettingsPatch | null => {
  const touched = SETTINGS_KEYS.filter(key => key in changes);
  if (touched.length === 0) return null;
  return Object.fromEntries(touched.map(key => [key, changes[key]?.newValue]));
};

// Merges a patch onto a loaded baseline; untouched fields keep their value.
export const applySettingsPatch = (settings: Settings, patch: SettingsPatch): Settings =>
  normalizeSettings({ ...settings, ...patch });
