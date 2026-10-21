/**
 * [POS]: Kernel settings readiness and run gate — reads the shared settings, applies changes, reports the RunState at the current time or loading/failed
 */
import { computeRunState, type RunState } from '../../shared/run-state';
import { applySettingsPatch, type SettingsPatch } from '../../shared/settings';
import { loadSettings, type SettingsStorageReader } from '../../shared/storage/settings-source';
import type { Settings } from '../../shared/types';
import type { Clock } from './types';

// 'loading' and 'failed' are internal readiness states, never product states:
// nothing is placed on an assumed default while the real settings are unknown.
export type GateState = RunState | 'loading' | 'failed';

export const createSettingsGate = (reader: SettingsStorageReader, clock: Clock, onFailure: (error: unknown) => void) => {
  let settings: Settings | null = null;
  let phase: 'loading' | 'loaded' | 'failed' = 'loading';
  let generation = 0;
  let current: Promise<void> = Promise.resolve();

  const load = () => {
    const mine = ++generation;
    phase = 'loading';
    current = loadSettings(reader).then(result => {
      if (mine !== generation) return;
      if (result.status === 'loaded') {
        settings = result.settings;
        phase = 'loaded';
      } else {
        phase = 'failed';
        onFailure(result.error);
      }
    });
  };

  load();

  return {
    // Run state at the current clock time — pause expiry needs no alarm.
    state(): GateState {
      if (phase === 'loaded' && settings) return computeRunState(settings, clock.now());
      return phase === 'failed' ? 'failed' : 'loading';
    },
    // A new event after a failed read gets a fresh attempt rather than a stale failure.
    retryIfFailed() {
      if (phase === 'failed') load();
    },
    // Resolves once no read is in flight (a superseding read is waited for too).
    async settled(): Promise<void> {
      while (phase === 'loading') {
        await current;
      }
    },
    // Applies a storage change. Without a loaded baseline the change cannot be merged,
    // so the whole settings value is read again instead.
    apply(patch: SettingsPatch) {
      if (phase === 'loaded' && settings) {
        settings = applySettingsPatch(settings, patch);
      } else {
        load();
      }
    },
  };
};
