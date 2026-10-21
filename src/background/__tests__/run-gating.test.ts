/**
 * [POS]: Behaviour tests of run gating — settings not ready or failed, skip while off/paused, cancel unissued placements, no catch-up, pause expiry on a fake clock
 */
import { describe, expect, it } from 'vitest';
import { PLACEMENT_BUDGET_MS } from '../kernel/types';
import { flush, setupKernel } from './fake-chrome';

const W = 1;
const A = 2;
const MINUTE = 60_000;
const at = (hh: number, mm: number) => Date.UTC(2026, 8, 25, hh, mm);

describe('settings readiness', () => {
  it('does not place on the enabled default before settings load, then skips once they load as off', async () => {
    let answer: (value: Record<string, unknown>) => void = () => undefined;
    const kit = setupKernel({ settings: () => new Promise(resolve => (answer = resolve)) });
    kit.world.seed(W, [1, A, 3]);

    const placed = kit.create(kit.world.open(W, 30, { opener: A }));
    await flush();
    expect(kit.world.calls.move).toEqual([]);
    answer({ enabled: false, pause_until: null });

    expect(await placed).toEqual({ status: 'skipped', reason: 'off' });
    expect(kit.world.calls.move).toEqual([]);
  });

  it('fails, not skips, a placement whose settings read outlasts the budget', async () => {
    const kit = setupKernel({ settings: () => new Promise(() => undefined) });
    kit.world.seed(W, [1, A, 3]);

    const placed = kit.create(kit.world.open(W, 30, { opener: A }));
    await flush();
    await kit.clock.advance(PLACEMENT_BUDGET_MS);

    expect(await placed).toEqual({ status: 'failed', reason: 'settings-unavailable' });
    expect(kit.world.calls.move).toEqual([]);
  });

  it('fails a placement when settings cannot be read, and retries the read on the next event', async () => {
    let reads = 0;
    const kit = setupKernel({
      settings: async () => {
        reads += 1;
        if (reads === 1) throw new Error('storage down');
        return { enabled: true, pause_until: null };
      },
    });
    kit.world.seed(W, [1, A, 3]);

    const failed = await kit.create(kit.world.open(W, 30, { opener: A }));
    const placed = await kit.create(kit.world.open(W, 31, { opener: A }));

    expect(failed).toEqual({ status: 'failed', reason: 'settings-unavailable' });
    expect(placed).toEqual({ status: 'applied', tabId: 31, index: 2 });
  });
});

describe('off and paused', () => {
  it('has no placement side effect while off, for links and opener-less tabs alike', async () => {
    const kit = setupKernel({ settings: { enabled: false, pause_until: null } });
    kit.world.seed(W, [1, A, 3]);
    await kit.activate(W, A);

    const link = await kit.create(kit.world.open(W, 30, { opener: A }));
    const blank = await kit.create(kit.world.open(W, 31, { active: true }));

    expect([link, blank]).toEqual([
      { status: 'skipped', reason: 'off' },
      { status: 'skipped', reason: 'off' },
    ]);
    expect(kit.world.calls.move).toEqual([]);
  });

  it('keeps observing while paused and resumes on new events only, without catching up', async () => {
    const kit = setupKernel({ now: at(14, 0), settings: { enabled: true, pause_until: at(14, 30) } });
    kit.world.seed(W, [1, A, 3]);

    await kit.activate(W, A);
    const duringPause = await kit.create(kit.world.open(W, 30, { active: true }));
    await kit.activate(W, 3);
    kit.clock.set(at(14, 30));
    const afterPause = await kit.create(kit.world.open(W, 31));

    expect(duringPause).toEqual({ status: 'skipped', reason: 'paused' });
    expect(afterPause).toEqual({ status: 'applied', tabId: 31, index: 3 });
    expect(kit.world.layout(W)).toEqual([1, A, 3, 31, 30]);
  });

  it('cancels a placement still waiting for the window when a pause arrives', async () => {
    const kit = setupKernel({ now: at(9, 0) });
    kit.world.seed(W, [1, A, 3]);
    kit.world.parkQueries();

    const placed = kit.create(kit.world.open(W, 30, { opener: A }));
    await flush();
    await kit.changeSettings({ pause_until: at(9, 30) });

    expect(await placed).toEqual({ status: 'cancelled', reason: 'paused' });
    await kit.drain();
    expect(kit.world.calls.move).toEqual([]);
  });

  it('lets a move already sent to Chrome finish, without undoing it or placing anything more', async () => {
    const kit = setupKernel({ now: at(9, 0) });
    kit.world.seed(W, [1, A, 3]);
    const realMove = kit.world.adapter.move;
    let release: () => void = () => undefined;
    kit.world.adapter.move = (tabId, index) =>
      new Promise(resolve => (release = () => resolve(realMove(tabId, index))));

    const placed = kit.create(kit.world.open(W, 30, { opener: A }));
    await flush();
    await kit.changeSettings({ enabled: false });
    release();

    expect(await placed).toEqual({ status: 'applied', tabId: 30, index: 2 });
    const next = await kit.create(kit.world.open(W, 31, { opener: A }));
    expect(next).toEqual({ status: 'skipped', reason: 'off' });
    expect(kit.world.layout(W)).toEqual([1, A, 30, 3, 31]);
  });

  it('keeps a 14:00→14:30 pause through off at 14:10 and on at 14:15, and resumes at 14:30 without an alarm', async () => {
    const kit = setupKernel({ now: at(14, 0), settings: { enabled: true, pause_until: at(14, 30) } });
    kit.world.seed(W, [1, A, 3]);
    const openAt = async (time: number, id: number) => {
      kit.clock.set(time);
      return kit.create(kit.world.open(W, id, { opener: A }));
    };

    await kit.changeSettings({ enabled: false });
    expect(await openAt(at(14, 10), 30)).toEqual({ status: 'skipped', reason: 'off' });
    await kit.changeSettings({ enabled: true });
    expect(await openAt(at(14, 15), 31)).toEqual({ status: 'skipped', reason: 'paused' });
    expect(await openAt(at(14, 29) + MINUTE - 1, 32)).toEqual({ status: 'skipped', reason: 'paused' });
    expect(await openAt(at(14, 30), 33)).toEqual({ status: 'applied', tabId: 33, index: 2 });
  });
});
