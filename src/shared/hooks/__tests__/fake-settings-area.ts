/**
 * [POS]: Test double of chrome.storage.local for the settings seam — controllable reads, writes and onChanged delivery
 */
import type { SettingsStorageArea, StorageChanges } from '../../storage/settings-repository';

// Like chrome.storage.local: a write lands in the data first, then onChanged
// announces it to every listener with only the keys that were written.
export const createFakeSettingsArea = (initial: Record<string, unknown>) => {
  const data: Record<string, unknown> = { ...initial };
  const listeners: Array<(changes: StorageChanges) => void> = [];
  const heldReads: Array<() => void> = [];
  const heldChanges: StorageChanges[] = [];
  let holdingReads = false;
  let holdingChanges = false;
  let readError: Error | null = null;
  let writeError: Error | null = null;

  const announce = (changes: StorageChanges) => listeners.forEach(listener => listener(changes));

  const area: SettingsStorageArea = {
    get: keys =>
      new Promise((resolve, reject) => {
        const answer = () => {
          if (readError) reject(readError);
          else resolve(Object.fromEntries(keys.filter(key => key in data).map(key => [key, data[key]])));
        };
        if (holdingReads) heldReads.push(answer);
        else answer();
      }),
    set: async items => {
      if (writeError) throw writeError;
      Object.assign(data, items);
      const changes = Object.fromEntries(Object.entries(items).map(([key, value]) => [key, { newValue: value }]));
      if (holdingChanges) heldChanges.push(changes);
      else announce(changes);
    },
    onChanged: {
      addListener: listener => {
        listeners.push(listener);
      },
    },
  };

  return {
    ...area,
    data,
    holdReads() {
      holdingReads = true;
    },
    releaseReads() {
      holdingReads = false;
      heldReads.splice(0).forEach(answer => answer());
    },
    holdChanges() {
      holdingChanges = true;
    },
    failReads(error: Error | null) {
      readError = error;
    },
    failWrites(error: Error | null) {
      writeError = error;
    },
  };
};
