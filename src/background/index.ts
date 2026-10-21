/**
 * [POS]: Background wiring — registers every Chrome listener synchronously and only translates events into kernel events; assembles the production adapters
 */
import { NEW_TAB_RIGHT_COMMAND } from '../shared/commands';
import { settingsPatchOf } from '../shared/settings';
import { migrateLegacySettings } from '../shared/storage/migrate-legacy-settings';
import { createChromeTabAdapter } from './adapters/chrome-tabs';
import { createSessionStore } from './adapters/session-store';
import { debugLog } from './debug-log';
import { createPlacementKernel } from './kernel/placement-kernel';
import type { Clock, KernelEvent } from './kernel/types';

const systemClock: Clock = {
  now: () => Date.now(),
  schedule(ms, callback) {
    const handle = setTimeout(callback, ms);
    return () => clearTimeout(handle);
  },
};

/**
 * Wires every Chrome event listener for the background service worker.
 *
 * Registration must stay synchronous: MV3 terminates idle workers, and a listener
 * attached after an await would miss the event that woke the worker up.
 */
export function startBackground(): void {
  const kernel = createPlacementKernel({
    settings: chrome.storage.local,
    tabs: createChromeTabAdapter(),
    session: createSessionStore(chrome.storage.session),
    clock: systemClock,
    log: debugLog,
  });
  const submit = (event: KernelEvent) => {
    void kernel.handle(event);
  };

  chrome.tabs.onCreated.addListener(tab => {
    if (tab.id === undefined) return;
    const { windowId, index, pinned, active, openerTabId } = tab;
    submit({ type: 'created', tab: { id: tab.id, windowId, index, pinned, active, openerTabId } });
  });
  chrome.tabs.onActivated.addListener(({ tabId, windowId }) => submit({ type: 'activated', tabId, windowId }));
  chrome.tabs.onRemoved.addListener((tabId, { windowId, isWindowClosing }) =>
    submit({ type: 'removed', tabId, windowId, isWindowClosing }),
  );
  chrome.tabs.onDetached.addListener((tabId, { oldWindowId }) => submit({ type: 'detached', tabId, windowId: oldWindowId }));
  chrome.tabs.onAttached.addListener((tabId, { newWindowId }) => submit({ type: 'attached', tabId, windowId: newWindowId }));
  chrome.windows.onRemoved.addListener(windowId => submit({ type: 'window-removed', windowId }));

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const patch = settingsPatchOf(changes);
    if (patch) submit({ type: 'settings-changed', patch });
  });

  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== NEW_TAB_RIGHT_COMMAND) return;
    const activeTab = tab?.id === undefined ? undefined : { id: tab.id, windowId: tab.windowId };
    submit({ type: 'command', activeTab });
  });

  chrome.runtime.onInstalled.addListener(details => {
    debugLog('background:installed', 'extension installed or updated', { reason: details.reason }, 'lifecycle');
    // Purge the three retired settings fields on both fresh installs and updates;
    // it is a no-op when they were never written. Absent enabled/pause_until keys
    // need no seeding: normalizeSettings resolves them to the defaults.
    migrateLegacySettings(chrome.storage.local).catch(error =>
      debugLog('background:installed', 'legacy settings migration failed', { error: String(error) }, 'lifecycle'),
    );
  });
}
