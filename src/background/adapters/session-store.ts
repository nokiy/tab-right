/**
 * [POS]: Production session-record adapter — stores each window's lastActive and chains in chrome.storage.session
 */
import type { SessionStore, WindowRecord } from '../kernel/types';

const keyOf = (windowId: number) => `window:${windowId}`;

const isIdList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(item => typeof item === 'number');

// Anything that does not look like a record is treated as no record at all.
const readRecord = (value: unknown): WindowRecord | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { lastActive, children } = value as Partial<WindowRecord>;
  if (typeof children !== 'object' || children === null || !Object.values(children).every(isIdList)) return null;
  return { lastActive: typeof lastActive === 'number' ? lastActive : null, children };
};

export const createSessionStore = (area: chrome.storage.StorageArea): SessionStore => ({
  async load(windowId) {
    const key = keyOf(windowId);
    const stored = await area.get(key);
    return readRecord(stored[key]);
  },
  save: (windowId, record) => area.set({ [keyOf(windowId)]: record }),
  remove: windowId => area.remove(keyOf(windowId)),
});
