/**
 * [POS]: Settings + RunState hook shared by popup and options — loading / failed / loaded view over the page's settings store, with write feedback
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { computeRunState, type RunState } from '../run-state';
import { sharedSettingsRepository, type SettingsRepository } from '../storage/settings-repository';
import type { Settings } from '../types';

const WRITE_FAILED_MESSAGE = '保存失败，设置未生效';

export type SettingsView =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'loaded';
      settings: Settings;
      runState: RunState;
      // Set while the last write failed; the shown settings are still the stored ones.
      writeError: string | null;
      pause: (minutes: number) => Promise<void>;
      resume: () => Promise<void>;
      setEnabled: (enabled: boolean) => Promise<void>;
    };

// Ticks while mounted so the paused -> running transition (and the "HH:MM 恢复"
// countdown) updates on screen even without a new storage write at pause_until.
const useNow = (intervalMs: number): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
};

// The store follows chrome.storage.local's onChanged, so an edit in one open surface
// (popup, options) re-renders every other open surface through this same hook.
export const useSettings = (repository: SettingsRepository = sharedSettingsRepository()): SettingsView => {
  const snapshot = useSyncExternalStore(repository.subscribe, repository.getSnapshot);
  const now = useNow(1000);
  const [writeError, setWriteError] = useState<string | null>(null);

  if (snapshot.status === 'loading') return { status: 'loading' };
  if (snapshot.status === 'failed') return { status: 'failed', retry: () => void repository.reload() };

  const write = async (patch: Partial<Settings>) => {
    const result = await repository.update(patch);
    setWriteError(result.status === 'written' ? null : WRITE_FAILED_MESSAGE);
  };

  return {
    status: 'loaded',
    settings: snapshot.settings,
    runState: computeRunState(snapshot.settings, now),
    writeError,
    pause: minutes => write({ pause_until: Date.now() + minutes * 60_000 }),
    resume: () => write({ pause_until: null }),
    setEnabled: enabled => write({ enabled }),
  };
};
