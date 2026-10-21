/**
 * [POS]: Tests of the legacy settings migration
 */
import { describe, expect, it } from 'vitest';
import { migrateLegacySettings } from '../migrate-legacy-settings';
import type { LegacySettingsStorage } from '../migrate-legacy-settings';

const fakeStorage = (initial: Record<string, unknown>): LegacySettingsStorage & { data: Record<string, unknown> } => {
  const data = { ...initial };
  return {
    data,
    get: async keys => Object.fromEntries(keys.filter(key => key in data).map(key => [key, data[key]])),
    remove: async keys => {
      for (const key of keys) {
        delete data[key];
      }
    },
  };
};

describe('migrateLegacySettings', () => {
  it('purges the three legacy keys while preserving enabled and pause_until', async () => {
    const storage = fakeStorage({
      enabled: false,
      pause_until: 999,
      disabled_hosts: ['example.com'],
      inherit_group: false,
      restore_active_tab: false,
    });

    await migrateLegacySettings(storage);

    expect(storage.data).toEqual({ enabled: false, pause_until: 999 });
  });

  it('is a no-op when no legacy keys are present', async () => {
    const storage = fakeStorage({ enabled: true, pause_until: null });

    await migrateLegacySettings(storage);

    expect(storage.data).toEqual({ enabled: true, pause_until: null });
  });

  it('does nothing on an empty store (fresh install)', async () => {
    const storage = fakeStorage({});

    await migrateLegacySettings(storage);

    expect(storage.data).toEqual({});
  });
});
