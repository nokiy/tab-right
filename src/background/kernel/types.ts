/**
 * [POS]: Public contract of the placement kernel — events, results and the injected ports (Chrome tabs, session record, clock, log)
 */
import type { SettingsPatch } from '../../shared/settings';
import type { SettingsStorageReader } from '../../shared/storage/settings-source';

// ---- Events: what an entry listener submits. Only facts Chrome actually provided. ----

export type CreatedTab = {
  id: number;
  windowId: number;
  index: number;
  pinned: boolean;
  active: boolean;
  openerTabId?: number;
};

// The active tab of the focused window, as Chrome reported it when the command fired.
export type ActiveTab = { id: number; windowId: number };

export type KernelEvent =
  | { type: 'created'; tab: CreatedTab }
  | { type: 'activated'; tabId: number; windowId: number }
  | { type: 'removed'; tabId: number; windowId: number; isWindowClosing: boolean }
  | { type: 'detached'; tabId: number; windowId: number }
  | { type: 'attached'; tabId: number; windowId: number }
  | { type: 'window-removed'; windowId: number }
  | { type: 'settings-changed'; patch: SettingsPatch }
  // The "new tab on the right" command; `activeTab` is absent when Chrome gave none.
  | { type: 'command'; activeTab?: ActiveTab };

// ---- Results: every submitted event settles to exactly one of these. ----

export type SkipReason =
  | 'native-correct'
  | 'anchor-unavailable'
  | 'off'
  | 'paused'
  | 'rebuild-timeout'
  | 'tab-closed'
  | 'window-closed'
  | 'duplicate'
  | 'pinned-tab'
  // The command's own tab, created without an index on purpose: never placed afterwards.
  | 'command-unplaced';

export type CancelReason = 'off' | 'paused';

export type FailReason = 'settings-unavailable' | 'window-query-failed' | 'move-failed' | 'create-failed';

export type PlacementResult =
  | { status: 'applied'; tabId: number; index: number }
  | { status: 'skipped'; reason: SkipReason }
  | { status: 'cancelled'; reason: CancelReason }
  | { status: 'failed'; reason: FailReason; error?: string }
  // Non-placement events (activation, removal, settings …) only update state.
  | { status: 'observed' };

// ---- Ports ----

export type TabSnapshot = { id: number; index: number; pinned: boolean };

export type MoveOutcome = { status: 'moved'; index: number } | { status: 'not-found' };

export type CreateRequest = { windowId?: number; index?: number; openerTabId?: number };

// The minimal Chrome surface the kernel needs. Rejections mean "Chrome failed";
// a vanished tab is reported as `not-found`, never as an empty success.
export type TabAdapter = {
  queryWindowTabs(windowId: number): Promise<TabSnapshot[]>;
  move(tabId: number, index: number): Promise<MoveOutcome>;
  create(request: CreateRequest): Promise<{ id: number; index: number }>;
};

// Per-window session record (chrome.storage.session): survives a background wake-up,
// cleared by an extension reload or a browser restart. Never holds indexes.
export type WindowRecord = {
  lastActive: number | null;
  children: Record<string, number[]>;
};

export type SessionStore = {
  load(windowId: number): Promise<WindowRecord | null>;
  save(windowId: number, record: WindowRecord): Promise<void>;
  remove(windowId: number): Promise<void>;
};

export type Clock = {
  now(): number;
  // Schedules `callback` after `ms`; the returned function cancels it.
  schedule(ms: number, callback: () => void): () => void;
};

// `category` groups entries in the debug log (stored as the entry's `hyp` field).
export type DebugLogger = (location: string, message: string, data: unknown, category: string) => void;

export type KernelDependencies = {
  settings: SettingsStorageReader;
  tabs: TabAdapter;
  session: SessionStore;
  clock: Clock;
  log: DebugLogger;
};

// Creating the kernel starts the initial settings read; events submitted before it
// finishes wait for it instead of assuming the enabled default.
export type PlacementKernel = {
  handle(event: KernelEvent): Promise<PlacementResult>;
};

// One budget covers settings wait, window rebuild and the per-placement query:
// from receipt of the event to issuing the Chrome call.
export const PLACEMENT_BUDGET_MS = 1000;
