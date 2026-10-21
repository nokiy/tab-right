/**
 * [POS]: Test doubles for kernel behaviour tests — fake tab strip (TabAdapter), fake clock, fake session record and fake settings source
 */
import { createPlacementKernel } from '../kernel/placement-kernel';
import type { Clock, CreatedTab, KernelEvent, PlacementKernel, SessionStore, TabAdapter, WindowRecord } from '../kernel/types';

type FakeTab = { id: number; windowId: number; pinned: boolean; groupId: number };

type ParkedQuery = { windowId: number; resolve: () => void; reject: (error: Error) => void };

export type FakeWorld = ReturnType<typeof createFakeWorld>;

// A tab strip model per window plus a recorder of every Chrome call the kernel makes.
export const createFakeWorld = () => {
  const strips = new Map<number, FakeTab[]>();
  const calls = { move: [] as Array<{ tabId: number; index: number }>, create: [] as unknown[], query: 0 };
  const parked: ParkedQuery[] = [];
  let parking = false;
  let nextId = 100;

  const strip = (windowId: number): FakeTab[] => {
    const existing = strips.get(windowId);
    if (existing) return existing;
    const created: FakeTab[] = [];
    strips.set(windowId, created);
    return created;
  };
  const find = (tabId: number) => {
    for (const tabs of strips.values()) {
      const tab = tabs.find(candidate => candidate.id === tabId);
      if (tab) return { tabs, index: tabs.indexOf(tab), tab };
    }
    return null;
  };
  const snapshot = (windowId: number) =>
    strip(windowId).map((tab, index) => ({ id: tab.id, index, pinned: tab.pinned }));

  const adapter: TabAdapter = {
    queryWindowTabs: windowId => {
      calls.query += 1;
      if (!parking) return Promise.resolve(snapshot(windowId));
      return new Promise((resolve, reject) => {
        parked.push({ windowId, resolve: () => resolve(snapshot(windowId)), reject });
      });
    },
    move: async (tabId, index) => {
      calls.move.push({ tabId, index });
      const found = find(tabId);
      if (!found) return { status: 'not-found' };
      found.tabs.splice(found.index, 1);
      found.tabs.splice(index, 0, found.tab);
      return { status: 'moved', index };
    },
    create: async request => {
      calls.create.push(request);
      const windowId = request.windowId ?? 1;
      const tabs = strip(windowId);
      const tab: FakeTab = { id: nextId++, windowId, pinned: false, groupId: -1 };
      tabs.splice(request.index ?? tabs.length, 0, tab);
      return { id: tab.id, index: tabs.indexOf(tab) };
    },
  };

  return {
    adapter,
    calls,
    // Seeds existing tabs (ids, in order) without emitting events, like tabs already open.
    seed(windowId: number, ids: number[], pinned: number[] = []) {
      strip(windowId).push(...ids.map(id => ({ id, windowId, pinned: pinned.includes(id), groupId: -1 })));
    },
    // Chrome creates a tab at `index` (default: end) and returns the onCreated payload.
    open(windowId: number, id: number, options: { index?: number; opener?: number; active?: boolean } = {}): CreatedTab {
      const tabs = strip(windowId);
      const index = options.index ?? tabs.length;
      tabs.splice(index, 0, { id, windowId, pinned: false, groupId: -1 });
      return { id, windowId, index, pinned: false, active: options.active ?? false, openerTabId: options.opener };
    },
    drag(tabId: number, index: number) {
      const found = find(tabId);
      if (!found) throw new Error(`no tab ${tabId}`);
      found.tabs.splice(found.index, 1);
      found.tabs.splice(index, 0, found.tab);
    },
    close(tabId: number) {
      const found = find(tabId);
      if (found) found.tabs.splice(found.index, 1);
    },
    transfer(tabId: number, windowId: number) {
      const found = find(tabId);
      if (!found) throw new Error(`no tab ${tabId}`);
      found.tabs.splice(found.index, 1);
      strip(windowId).push({ ...found.tab, windowId });
    },
    setGroup(tabId: number, groupId: number) {
      const found = find(tabId);
      if (found) found.tab.groupId = groupId;
    },
    layout: (windowId: number) => strip(windowId).map(tab => tab.id),
    parkQueries() {
      parking = true;
    },
    parkedCount: () => parked.length,
    // Answers a parked query (the oldest by default) with the strip as it is *now*.
    releaseQuery(pick: { windowId?: number; newest?: boolean } = {}) {
      const matching = parked.filter(query => pick.windowId === undefined || query.windowId === pick.windowId);
      const query = pick.newest ? matching.at(-1) : matching[0];
      if (!query) throw new Error('no parked query');
      parked.splice(parked.indexOf(query), 1);
      query.resolve();
    },
    failQuery() {
      const query = parked.shift();
      if (!query) throw new Error('no parked query');
      query.reject(new Error('query exploded'));
    },
    resumeQueries() {
      parking = false;
    },
  };
};

export type FakeClock = Clock & { advance(ms: number): Promise<void>; set(time: number): void };

export const createFakeClock = (start = 0): FakeClock => {
  let now = start;
  const timers: Array<{ at: number; callback: () => void; live: boolean }> = [];
  return {
    now: () => now,
    set(time: number) {
      now = time;
    },
    schedule(ms, callback) {
      const timer = { at: now + ms, callback, live: true };
      timers.push(timer);
      return () => {
        timer.live = false;
      };
    },
    async advance(ms: number) {
      now += ms;
      for (const timer of timers) {
        if (timer.live && timer.at <= now) {
          timer.live = false;
          timer.callback();
        }
      }
      await flush();
    },
  };
};

export const createFakeSession = (initial: Record<number, WindowRecord> = {}) => {
  const records = new Map<number, WindowRecord>(Object.entries(initial).map(([id, record]) => [Number(id), record]));
  const store: SessionStore = {
    load: async windowId => records.get(windowId) ?? null,
    save: async (windowId, record) => {
      records.set(windowId, structuredClone(record));
    },
    remove: async windowId => {
      records.delete(windowId);
    },
  };
  return { store, records };
};

// Lets every already-resolved promise chain run to completion.
export const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
};

type KernelSetup = {
  settings?: Record<string, unknown> | (() => Promise<Record<string, unknown>>);
  session?: Record<number, WindowRecord>;
  now?: number;
};

// Builds a started kernel wired to fresh fakes.
export const setupKernel = (options: KernelSetup = {}) => {
  const world = createFakeWorld();
  const clock = createFakeClock(options.now ?? 0);
  const session = createFakeSession(options.session);
  const logs: Array<{ loc: string; msg: string; data: unknown }> = [];
  // Like chrome.storage.local: a change is written first, then announced to the kernel.
  const stored = typeof options.settings === 'function' ? null : { enabled: true, pause_until: null, ...options.settings };
  const read = typeof options.settings === 'function' ? options.settings : async () => ({ ...stored });
  const kernel: PlacementKernel = createPlacementKernel({
    settings: { get: read },
    tabs: world.adapter,
    session: session.store,
    clock,
    log: (loc, msg, data) => logs.push({ loc, msg, data }),
  });
  const submit = (event: KernelEvent) => kernel.handle(event);
  // A foreground/background creation as Chrome reports it: onCreated, then (if active) onActivated.
  const create = (tab: CreatedTab) => {
    const placed = kernel.handle({ type: 'created', tab });
    if (tab.active) void kernel.handle({ type: 'activated', tabId: tab.id, windowId: tab.windowId });
    return placed;
  };
  const changeSettings = (patch: Record<string, unknown>) => {
    if (stored) Object.assign(stored, patch);
    return kernel.handle({ type: 'settings-changed', patch });
  };
  const activate = (windowId: number, tabId: number) => kernel.handle({ type: 'activated', tabId, windowId });
  // Answers every parked query, including ones issued while answering, oldest first.
  const drain = async () => {
    await flush();
    while (world.parkedCount() > 0) {
      world.releaseQuery();
      await flush();
    }
  };
  return { kernel, world, clock, session, logs, submit, create, activate, drain, changeSettings };
};
