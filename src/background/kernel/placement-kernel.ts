/**
 * [POS]: Placement kernel — the single entry handle(event): run gating, per-window queueing, operation lifecycle, pure decisions, then the move or the in-place create
 */
import type { SettingsPatch } from '../../shared/settings';
import { decideCreate, decidePlacement } from './placement-decision';
import { createSettingsGate, type GateState } from './settings-gate';
import { createWindowTracker, type WindowSlot } from './window-tracker';
import { describeError, within } from './within';
import {
  PLACEMENT_BUDGET_MS,
  type ActiveTab,
  type CreatedTab,
  type KernelDependencies,
  type KernelEvent,
  type PlacementKernel,
  type PlacementResult,
  type TabSnapshot,
} from './types';

// One placement request from receipt to its terminal result.
type Operation = {
  readonly receivedAt: number;
  // Cancellable ops are settled early by pause/off; command ops always end in a create.
  readonly cancellable: boolean;
  // Settings were not known at receipt, so off/paused later means "skipped", not "cancelled".
  readonly acceptedUnready: boolean;
  issued: boolean;
  settled: boolean;
  resolve: (result: PlacementResult) => void;
  promise: Promise<PlacementResult>;
};

type SkipReason = Extract<PlacementResult, { status: 'skipped' }>['reason'];

const OBSERVED: PlacementResult = { status: 'observed' };
const SETTINGS_UNAVAILABLE: PlacementResult = { status: 'failed', reason: 'settings-unavailable' };
const skipped = (reason: SkipReason): PlacementResult => ({ status: 'skipped', reason });

const isHalted = (state: GateState): state is 'off' | 'paused' => state === 'off' || state === 'paused';

const failureOf = (slot: WindowSlot): PlacementResult => {
  if (slot.failure === 'window-query-failed') return { status: 'failed', reason: 'window-query-failed' };
  return skipped(slot.failure === 'window-closed' ? 'window-closed' : 'rebuild-timeout');
};

// Maps a non-running gate to the result a placement gets when it must stop.
const stopped = (op: Operation, state: Exclude<GateState, 'running'>): PlacementResult => {
  if (!isHalted(state)) return SETTINGS_UNAVAILABLE;
  return op.acceptedUnready ? skipped(state) : { status: 'cancelled', reason: state };
};

export const createPlacementKernel = (deps: KernelDependencies): PlacementKernel => {
  const { tabs, clock, log } = deps;
  const gate = createSettingsGate(deps.settings, clock, error =>
    log('kernel:settings', 'settings read failed', { error: describeError(error) }, 'kernel'),
  );
  const windows = createWindowTracker(deps);
  const cancellable = new Set<Operation>();
  const creations = new Set<number>();
  // Tabs the command created without an index, and the creates still awaiting Chrome's answer.
  const unplaced = new Set<number>();
  const plainCreates = new Set<Promise<void>>();

  const open = (isCancellable: boolean): Operation => {
    let resolve: (result: PlacementResult) => void = () => undefined;
    const promise = new Promise<PlacementResult>(done => {
      resolve = done;
    });
    const state = gate.state();
    const op: Operation = {
      receivedAt: clock.now(),
      cancellable: isCancellable,
      acceptedUnready: state === 'loading' || state === 'failed',
      issued: false,
      settled: false,
      resolve,
      promise,
    };
    if (isCancellable) cancellable.add(op);
    return op;
  };

  const settle = (op: Operation, result: PlacementResult) => {
    if (op.settled) return;
    op.settled = true;
    cancellable.delete(op);
    op.resolve(result);
  };

  // Runs one Chrome side effect; a rejection settles the op as that failure.
  const attempt = async (op: Operation, reason: 'move-failed' | 'create-failed', work: () => Promise<PlacementResult>) => {
    try {
      settle(op, await work());
    } catch (error) {
      settle(op, { status: 'failed', reason, error: describeError(error) });
    }
  };

  const remaining = (op: Operation) => op.receivedAt + PLACEMENT_BUDGET_MS - clock.now();

  // Waits (within budget) for settings and re-checks the gate. Null means "go on".
  const admit = async (op: Operation): Promise<PlacementResult | null> => {
    const waited = await within(clock, remaining(op), gate.settled());
    if (waited.kind !== 'ok') return SETTINGS_UNAVAILABLE;
    const state = gate.state();
    return state === 'running' ? null : stopped(op, state);
  };

  const snapshot = async (op: Operation, windowId: number): Promise<TabSnapshot[] | PlacementResult> => {
    const outcome = await within(clock, remaining(op), tabs.queryWindowTabs(windowId));
    if (outcome.kind === 'ok') return outcome.value;
    return outcome.kind === 'timeout' ? skipped('rebuild-timeout') : { status: 'failed', reason: 'window-query-failed' };
  };

  // Last check before a Chrome side effect: still running, still within budget.
  const clearToIssue = (op: Operation): PlacementResult | null => {
    const state = gate.state();
    if (state !== 'running') return stopped(op, state);
    if (clock.now() - op.receivedAt > PLACEMENT_BUDGET_MS) return skipped('rebuild-timeout');
    op.issued = true;
    return null;
  };

  // Chrome may deliver onCreated before tabs.create answers, so pending plain creates
  // are waited for (within budget) before deciding a tab is not the command's own.
  const isUnplaced = async (op: Operation, tabId: number): Promise<boolean> => {
    if (plainCreates.size > 0) await within(clock, remaining(op), Promise.all(plainCreates));
    return unplaced.has(tabId);
  };

  const placeCreated = async (op: Operation, tab: CreatedTab, slot: WindowSlot): Promise<void> => {
    if (slot.phase !== 'ready') return settle(op, failureOf(slot));
    slot.known.add(tab.id);
    if (tab.active) slot.fresh.add(tab.id);
    if (op.settled) return;
    if (await isUnplaced(op, tab.id)) return settle(op, skipped('command-unplaced'));
    const refusal = await admit(op);
    if (refusal) return settle(op, refusal);
    const strip = await snapshot(op, tab.windowId);
    if (!Array.isArray(strip)) return settle(op, strip);
    if (op.settled) return;
    const evidence = { openerTabId: tab.openerTabId, lastActive: slot.lastActive };
    const decision = decidePlacement(strip, tab.id, evidence, windows.chainOf(slot));
    if (decision.kind === 'skip') {
      if (decision.reason === 'anchor-unavailable') {
        log('kernel:anchor', 'anchor-unavailable', { windowId: tab.windowId, tabId: tab.id, ...evidence }, 'kernel');
      }
      return settle(op, skipped(decision.reason));
    }
    if (decision.kind === 'native-correct') {
      windows.joinChain(slot, decision.anchorId, tab.id);
      return settle(op, skipped('native-correct'));
    }
    const blocked = clearToIssue(op);
    if (blocked) return settle(op, blocked);
    await attempt(op, 'move-failed', async () => {
      const moved = await tabs.move(tab.id, decision.index);
      if (moved.status === 'not-found') return skipped('tab-closed');
      windows.joinChain(slot, decision.anchorId, tab.id);
      return { status: 'applied', tabId: tab.id, index: moved.index };
    });
  };

  // The command must always yield a tab: without a placement it is created where
  // Chrome puts it by default, with no index and no opener, and is never placed later.
  const createPlain = async (op: Operation, windowId: number | undefined, result: PlacementResult) => {
    const creating = tabs.create(windowId === undefined ? {} : { windowId });
    const noted = creating.then(
      created => void unplaced.add(created.id),
      () => undefined,
    );
    plainCreates.add(noted);
    void noted.then(() => plainCreates.delete(noted));
    await attempt(op, 'create-failed', async () => {
      await creating;
      return result;
    });
  };

  const createOnRight = async (op: Operation, active: ActiveTab, slot: WindowSlot) => {
    const { windowId } = active;
    if (slot.phase !== 'ready') return createPlain(op, windowId, failureOf(slot));
    const refusal = await admit(op);
    if (refusal) return createPlain(op, windowId, refusal);
    const strip = await snapshot(op, windowId);
    if (!Array.isArray(strip)) return createPlain(op, windowId, strip);
    const evidence = { openerTabId: active.id, lastActive: slot.lastActive };
    const decision = decideCreate(strip, evidence, windows.chainOf(slot));
    if (decision.kind === 'skip') {
      log('kernel:anchor', 'anchor-unavailable', { windowId, command: true, activeTabId: active.id }, 'kernel');
      return createPlain(op, windowId, skipped('anchor-unavailable'));
    }
    const blocked = clearToIssue(op);
    if (blocked) return createPlain(op, windowId, blocked);
    // The new tab's own onCreated arrives with this opener at this index and joins
    // the chain there as native-correct; the command does not register it twice.
    await attempt(op, 'create-failed', async () => {
      const created = await tabs.create({ windowId, index: decision.index, openerTabId: decision.anchorId });
      return { status: 'applied', tabId: created.id, index: created.index };
    });
  };

  const traced = (loc: string, data: object, op: Operation) =>
    op.promise.then(result => {
      log(loc, result.status, { ...data, result }, 'kernel');
      return result;
    });

  const onCreated = (tab: CreatedTab): Promise<PlacementResult> => {
    if (creations.has(tab.id)) return Promise.resolve(skipped('duplicate'));
    creations.add(tab.id);
    gate.retryIfFailed();
    const op = open(true);
    const state = gate.state();
    // Observed while off/paused: the tab is still tracked, never placed or caught up later.
    if (isHalted(state)) settle(op, skipped(state));
    void windows.enqueue(tab.windowId, slot => placeCreated(op, tab, slot));
    return traced('kernel:created', { tabId: tab.id, windowId: tab.windowId }, op);
  };

  const onCommand = (active: ActiveTab | undefined): Promise<PlacementResult> => {
    gate.retryIfFailed();
    const op = open(false);
    const state = gate.state();
    if (!active) void createPlain(op, undefined, skipped('anchor-unavailable'));
    else if (isHalted(state)) void createPlain(op, active.windowId, skipped(state));
    else void windows.enqueue(active.windowId, slot => createOnRight(op, active, slot));
    return traced('kernel:command', { activeTab: active ?? null }, op);
  };

  const observe = (windowId: number, update: (slot: WindowSlot) => void): Promise<PlacementResult> =>
    windows.enqueue(windowId, slot => {
      if (slot.phase === 'ready') update(slot);
      return OBSERVED;
    });

  const onSettingsChanged = (patch: SettingsPatch): PlacementResult => {
    gate.apply(patch);
    const state = gate.state();
    if (isHalted(state)) {
      for (const op of [...cancellable]) {
        if (!op.issued) settle(op, { status: 'cancelled', reason: state });
      }
    }
    return OBSERVED;
  };

  const handle = (event: KernelEvent): Promise<PlacementResult> => {
    switch (event.type) {
      case 'created':
        return onCreated(event.tab);
      case 'command':
        return onCommand(event.activeTab);
      case 'activated':
        return observe(event.windowId, slot => {
          // The activation that accompanies a tab's own creation is not a switch.
          if (slot.fresh.delete(event.tabId) || !slot.known.has(event.tabId)) return;
          windows.recordActive(slot, event.tabId);
        });
      case 'removed':
        creations.delete(event.tabId);
        unplaced.delete(event.tabId);
        // A closing window is dropped as a whole by 'window-removed'.
        if (event.isWindowClosing) return Promise.resolve(OBSERVED);
        return observe(event.windowId, slot => windows.forget(slot, event.tabId));
      case 'detached':
        return observe(event.windowId, slot => windows.forget(slot, event.tabId));
      case 'attached':
        return observe(event.windowId, slot => {
          slot.known.add(event.tabId);
        });
      case 'window-removed':
        windows.close(event.windowId);
        return Promise.resolve(OBSERVED);
      case 'settings-changed':
        return Promise.resolve(onSettingsChanged(event.patch));
    }
  };

  return { handle };
};
