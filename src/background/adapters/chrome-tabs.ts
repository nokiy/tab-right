/**
 * [POS]: Production chrome.tabs adapter of the kernel — reads a window's tabs, moves, creates in place; tells a missing tab apart from a Chrome failure
 */
import type { TabAdapter } from '../kernel/types';

const isMissingTab = (error: unknown) => error instanceof Error && /no tab with id/i.test(error.message);

export const createChromeTabAdapter = (): TabAdapter => ({
  async queryWindowTabs(windowId) {
    const tabs = await chrome.tabs.query({ windowId });
    return tabs.flatMap(tab => (tab.id === undefined ? [] : [{ id: tab.id, index: tab.index, pinned: tab.pinned }]));
  },

  async move(tabId, index) {
    try {
      const moved = await chrome.tabs.move(tabId, { index });
      const tab = Array.isArray(moved) ? moved[0] : moved;
      return { status: 'moved', index: tab?.index ?? index };
    } catch (error) {
      if (isMissingTab(error)) return { status: 'not-found' };
      throw error;
    }
  },

  async create(request) {
    const tab = await chrome.tabs.create(request);
    if (tab.id === undefined) throw new Error('Chrome created a tab without an id');
    return { id: tab.id, index: tab.index };
  },
});
