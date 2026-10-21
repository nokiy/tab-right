/**
 * [POS]: Popup/options settings store — one SettingsSnapshot per page, read through loadSettings, kept live by onChanged; writes only the fields that change
 */
import { applySettingsPatch, settingsPatchOf } from '../settings';
import type { Settings } from '../types';
import { loadSettings, type SettingsStorageReader } from './settings-source';

export type StorageChanges = Record<string, { newValue?: unknown }>;

// The chrome.storage.local surface the store needs: read, field-level write, and the
// area's own change event (fired for writes from any extension page or the worker).
export type SettingsStorageArea = SettingsStorageReader & {
  set(items: Partial<Settings>): Promise<void>;
  onChanged: { addListener(callback: (changes: StorageChanges) => void): void };
};

// No Settings value exists until a read succeeds: callers render loading or failure,
// never the enabled default.
export type SettingsSnapshot =
  | { status: 'loading' }
  | { status: 'loaded'; settings: Settings }
  | { status: 'failed'; error: unknown };

export type SettingsWriteResult = { status: 'written' } | { status: 'write-failed'; error: unknown };

export type SettingsRepository = {
  getSnapshot(): SettingsSnapshot;
  subscribe(listener: () => void): () => void;
  // Writes only the given fields; the snapshot changes only after the write succeeded.
  update(patch: Partial<Settings>): Promise<SettingsWriteResult>;
  reload(): Promise<void>;
};

export const createSettingsRepository = (area: SettingsStorageArea): SettingsRepository => {
  let snapshot: SettingsSnapshot = { status: 'loading' };
  let generation = 0;
  const listeners = new Set<() => void>();

  const publish = (next: SettingsSnapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };

  const reload = async () => {
    const mine = ++generation;
    if (snapshot.status === 'failed') publish({ status: 'loading' });
    const result = await loadSettings(area);
    // A newer read supersedes this one.
    if (mine !== generation) return;
    publish(result.status === 'loaded' ? result : { status: 'failed', error: result.error });
  };

  area.onChanged.addListener(changes => {
    const patch = settingsPatchOf(changes);
    if (!patch) return;
    // Without a loaded baseline a patch cannot be merged, so read everything again.
    if (snapshot.status === 'loaded') publish({ status: 'loaded', settings: applySettingsPatch(snapshot.settings, patch) });
    else void reload();
  });

  const update = async (patch: Partial<Settings>): Promise<SettingsWriteResult> => {
    if (snapshot.status !== 'loaded') return { status: 'write-failed', error: new Error('settings are not loaded') };
    try {
      await area.set(patch);
    } catch (error) {
      return { status: 'write-failed', error };
    }
    if (snapshot.status === 'loaded') publish({ status: 'loaded', settings: applySettingsPatch(snapshot.settings, patch) });
    return { status: 'written' };
  };

  void reload();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update,
    reload,
  };
};

let shared: SettingsRepository | null = null;

// The page-wide store over chrome.storage.local, created on first use so importing
// this module never touches the chrome global.
export const sharedSettingsRepository = (): SettingsRepository => {
  shared ??= createSettingsRepository(chrome.storage.local);
  return shared;
};
