/**
 * [POS]: Legacy settings migration — purges retired storage keys while keeping enabled/pause_until semantics
 */
// A minimal seam over chrome.storage.local, narrowed to what the migration needs.
export type LegacySettingsStorage = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  remove(keys: string[]): Promise<void>;
};

const LEGACY_KEYS = ['disabled_hosts', 'inherit_group', 'restore_active_tab'] as const;

// Purges the three retired settings fields (site exceptions, group inheritance,
// focus restore) from chrome.storage.local, without touching enabled/pause_until —
// preserving the user's existing enabled and pause semantics across the upgrade.
export const migrateLegacySettings = async (storage: LegacySettingsStorage): Promise<void> => {
  const existing = await storage.get([...LEGACY_KEYS]);
  const keysToRemove = LEGACY_KEYS.filter(key => key in existing);
  if (keysToRemove.length > 0) {
    await storage.remove(keysToRemove);
  }
};
