/**
 * [POS]: Tests of the one settings reader — loaded vs failed
 */
import { describe, expect, it } from 'vitest';
import { loadSettings } from '../settings-source';
import type { SettingsStorageReader } from '../settings-source';

const fakeStorage = (get: SettingsStorageReader['get']): SettingsStorageReader => ({ get });

describe('loadSettings', () => {
  it('reports loaded with defaults on a first-install read (absent keys)', async () => {
    const storage = fakeStorage(async () => ({}));
    const result = await loadSettings(storage);
    expect(result).toEqual({ status: 'loaded', settings: { enabled: true, pause_until: null } });
  });

  it('reports loaded with the stored values when present', async () => {
    const storage = fakeStorage(async () => ({ enabled: false, pause_until: 500 }));
    const result = await loadSettings(storage);
    expect(result).toEqual({ status: 'loaded', settings: { enabled: false, pause_until: 500 } });
  });

  it('reports failed, not default-enabled, when the storage read throws', async () => {
    const storage = fakeStorage(async () => {
      throw new Error('storage unavailable');
    });
    const result = await loadSettings(storage);
    expect(result.status).toBe('failed');
    expect(result).not.toHaveProperty('settings');
  });
});
