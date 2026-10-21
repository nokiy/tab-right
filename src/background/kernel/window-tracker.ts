/**
 * [POS]: Per-window state machine and serial queue — unknown→rebuilding→ready|unavailable with generations, the rebuild budget, session record restore/persist, and chain bookkeeping
 */
import { describeError, within } from './within';
import { PLACEMENT_BUDGET_MS, type Clock, type DebugLogger, type SessionStore, type TabAdapter, type WindowRecord } from './types';

export type WindowFailure = 'rebuild-timeout' | 'window-query-failed' | 'window-closed';

// Per-window memory. Tab order is never stored: indexes come from a fresh snapshot
// at decision time; only identities (known tabs, lastActive, chains) live here.
export type WindowSlot = {
  readonly windowId: number;
  phase: 'rebuilding' | 'ready' | 'unavailable' | 'closed';
  generation: number;
  failure: WindowFailure | null;
  known: Set<number>;
  // Tabs created active whose accompanying onActivated has not arrived yet.
  fresh: Set<number>;
  lastActive: number | null;
  children: Map<number, number[]>;
  tail: Promise<void>;
};

type TrackerDeps = { tabs: TabAdapter; session: SessionStore; clock: Clock; log: DebugLogger };

const restore = (slot: WindowSlot, ids: number[], record: WindowRecord | null) => {
  slot.known = new Set(ids);
  // Session records survive a wake-up but may name tabs that are gone: verify each one.
  slot.lastActive = record?.lastActive != null && slot.known.has(record.lastActive) ? record.lastActive : null;
  slot.children = new Map();
  for (const [anchor, members] of Object.entries(record?.children ?? {})) {
    const alive = members.filter(id => slot.known.has(id));
    if (slot.known.has(Number(anchor)) && alive.length > 0) {
      slot.children.set(Number(anchor), alive);
    }
  }
};

export const createWindowTracker = ({ tabs, session, clock, log }: TrackerDeps) => {
  const slots = new Map<number, WindowSlot>();

  const rebuild = async (slot: WindowSlot): Promise<void> => {
    const generation = ++slot.generation;
    slot.phase = 'rebuilding';
    const loadRecord = session.load(slot.windowId).catch(error => {
      log('kernel:rebuild', 'session record unreadable', { windowId: slot.windowId, error: describeError(error) }, 'kernel');
      return null;
    });
    const outcome = await within(clock, PLACEMENT_BUDGET_MS, Promise.all([tabs.queryWindowTabs(slot.windowId), loadRecord]));
    // A result from an older generation, or for a window closed meanwhile, is discarded.
    if (slot.generation !== generation || slot.phase !== 'rebuilding') return;
    if (outcome.kind === 'ok') {
      const [snapshot, record] = outcome.value;
      restore(slot, snapshot.map(tab => tab.id), record);
      slot.phase = 'ready';
      slot.failure = null;
      return;
    }
    slot.phase = 'unavailable';
    slot.failure = outcome.kind === 'timeout' ? 'rebuild-timeout' : 'window-query-failed';
    log('kernel:rebuild', slot.failure, { windowId: slot.windowId, generation }, 'kernel');
  };

  const slotFor = (windowId: number): WindowSlot => {
    let slot = slots.get(windowId);
    if (!slot) {
      slot = {
        windowId,
        phase: 'unavailable',
        generation: 0,
        failure: null,
        known: new Set(),
        fresh: new Set(),
        lastActive: null,
        children: new Map(),
        tail: Promise.resolve(),
      };
      slots.set(windowId, slot);
    }
    // The first event for a window, or the next one after a failed rebuild, starts a
    // new generation. The rebuild itself sits in the queue, so later events wait for it.
    if (slot.phase === 'unavailable') {
      const pending = rebuild(slot);
      slot.tail = slot.tail.then(() => pending);
    }
    return slot;
  };

  // Memory first, then the session record — callers mutate the slot synchronously.
  const persist = (slot: WindowSlot) => {
    if (slot.phase === 'closed') return;
    const record: WindowRecord = { lastActive: slot.lastActive, children: Object.fromEntries(slot.children) };
    session.save(slot.windowId, record).catch(error => {
      log('kernel:persist', 'session record write failed', { windowId: slot.windowId, error: describeError(error) }, 'kernel');
    });
  };

  return {
    // Runs `task` after every earlier task of the same window, in receipt order.
    // Windows never wait for each other.
    enqueue<T>(windowId: number, task: (slot: WindowSlot) => Promise<T> | T): Promise<T> {
      const slot = slotFor(windowId);
      const run = slot.tail.then(() => task(slot));
      slot.tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    close(windowId: number) {
      const slot = slots.get(windowId);
      if (slot) {
        slot.phase = 'closed';
        slot.failure = 'window-closed';
        slots.delete(windowId);
      }
      void session.remove(windowId).catch(() => undefined);
    },
    // A switch to an already-known tab updates the pre-creation active tab record.
    recordActive(slot: WindowSlot, tabId: number) {
      slot.lastActive = tabId;
      persist(slot);
    },
    // Direct children of an anchor, in creation order.
    chainOf: (slot: WindowSlot) => (anchorId: number) => slot.children.get(anchorId) ?? [],
    joinChain(slot: WindowSlot, anchorId: number, tabId: number) {
      const members = slot.children.get(anchorId) ?? [];
      if (!members.includes(tabId)) members.push(tabId);
      slot.children.set(anchorId, members);
      persist(slot);
    },
    // Drops a tab that left the window from every identity the window remembers.
    forget(slot: WindowSlot, tabId: number) {
      slot.known.delete(tabId);
      slot.fresh.delete(tabId);
      if (slot.lastActive === tabId) slot.lastActive = null;
      slot.children.delete(tabId);
      for (const [anchorId, members] of slot.children) {
        const rest = members.filter(id => id !== tabId);
        if (rest.length > 0) slot.children.set(anchorId, rest);
        else slot.children.delete(anchorId);
      }
      persist(slot);
    },
  };
};
