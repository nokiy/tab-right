/**
 * [POS]: Behaviour tests of the new-tab-on-the-right command — born in place, no double open, still creates (unplaced) when paused/off or without a reliable source
 */
import { describe, expect, it } from 'vitest';
import type { CreateRequest } from '../kernel/types';
import { flush, setupKernel } from './fake-chrome';

const W = 1;
const A = 2;

type Kit = ReturnType<typeof setupKernel>;

// Presses the shortcut on `active`, then delivers the new tab's onCreated as Chrome would.
// Tabs the fake creates get IDs from 100 up, so the newest one is the largest ID.
const press = async (kit: Kit, active: number) => {
  const before = kit.world.calls.create.length;
  const result = await kit.submit({ type: 'command', activeTab: { id: active, windowId: W } });
  if (kit.world.calls.create.length === before) return { result, followUp: null };
  const request = kit.world.calls.create.at(-1) as CreateRequest;
  const id = Math.max(...kit.world.layout(W));
  const index = kit.world.layout(W).indexOf(id);
  const tab = { id, windowId: W, index, pinned: false, active: true, openerTabId: request.openerTabId };
  return { result, followUp: await kit.create(tab) };
};

describe('new tab on the right command', () => {
  it('creates the tab directly at the chain tail + 1 with the anchor as opener, never moving it', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);

    const first = await press(kit, A);
    const second = await press(kit, A);

    expect(kit.world.calls.create).toEqual([
      { windowId: W, index: 2, openerTabId: A },
      { windowId: W, index: 3, openerTabId: A },
    ]);
    expect(first.result).toEqual({ status: 'applied', tabId: 100, index: 2 });
    expect(first.followUp).toEqual({ status: 'skipped', reason: 'native-correct' });
    expect(second.followUp).toEqual({ status: 'skipped', reason: 'native-correct' });
    expect(kit.world.calls.move).toEqual([]);
    expect(kit.world.layout(W)).toEqual([1, A, 100, 101, 3]);
  });

  it('still creates one plain tab, without index or placement, while paused', async () => {
    const kit = setupKernel({ now: 1000, settings: { enabled: true, pause_until: 5000 } });
    kit.world.seed(W, [1, A, 3]);

    const { result, followUp } = await press(kit, A);

    expect(result).toEqual({ status: 'skipped', reason: 'paused' });
    expect(kit.world.calls.create).toEqual([{ windowId: W }]);
    expect(followUp).toEqual({ status: 'skipped', reason: 'paused' });
    expect(kit.world.calls.move).toEqual([]);
  });

  it('still creates one plain tab while off', async () => {
    const kit = setupKernel({ settings: { enabled: false } });
    kit.world.seed(W, [1, A, 3]);

    const { result } = await press(kit, A);

    expect(result).toEqual({ status: 'skipped', reason: 'off' });
    expect(kit.world.calls.create).toEqual([{ windowId: W }]);
  });

  it('creates a plain tab and logs anchor-unavailable when Chrome reports no active tab', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);

    const result = await kit.submit({ type: 'command' });

    expect(result).toEqual({ status: 'skipped', reason: 'anchor-unavailable' });
    expect(kit.world.calls.create).toEqual([{}]);
  });

  it('never re-places the plain tab it created without a source, even with a lastActive record', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    await kit.activate(W, A);

    await kit.submit({ type: 'command' });
    const id = Math.max(...kit.world.layout(W));
    const followUp = await kit.create({ id, windowId: W, index: kit.world.layout(W).indexOf(id), pinned: false, active: true });

    expect(followUp).toEqual({ status: 'skipped', reason: 'command-unplaced' });
    expect(kit.world.calls.move).toEqual([]);
  });

  it('recognises its plain tab even when onCreated arrives before tabs.create resolves', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    await kit.activate(W, A);
    const realCreate = kit.world.adapter.create;
    // The tab exists in the strip at once; only the tabs.create answer is held back.
    let finish: () => void = () => undefined;
    kit.world.adapter.create = request => {
      const created = realCreate(request);
      return new Promise(resolve => (finish = () => resolve(created)));
    };

    const pressed = kit.submit({ type: 'command' });
    await flush();
    const id = Math.max(...kit.world.layout(W));
    const followUp = kit.create({ id, windowId: W, index: 3, pinned: false, active: true });
    await flush();
    finish();
    await pressed;

    expect(await followUp).toEqual({ status: 'skipped', reason: 'command-unplaced' });
    expect(kit.world.calls.move).toEqual([]);
  });

  it('creates a plain tab when the reported active tab is gone and no record exists', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, 3]);

    const result = await kit.submit({ type: 'command', activeTab: { id: A, windowId: W } });

    expect(result).toEqual({ status: 'skipped', reason: 'anchor-unavailable' });
    expect(kit.world.calls.create).toEqual([{ windowId: W }]);
    expect(kit.logs.some(entry => entry.msg === 'anchor-unavailable')).toBe(true);
  });

  it('still creates a plain tab when a pause lands while the command waits for the window', async () => {
    const kit = setupKernel({ now: 0 });
    kit.world.seed(W, [1, A, 3]);
    kit.world.parkQueries();
    await flush();

    const pressed = kit.submit({ type: 'command', activeTab: { id: A, windowId: W } });
    await flush();
    await kit.changeSettings({ pause_until: 60_000 });
    await kit.drain();

    expect(await pressed).toEqual({ status: 'cancelled', reason: 'paused' });
    expect(kit.world.calls.create).toEqual([{ windowId: W }]);
  });
});
