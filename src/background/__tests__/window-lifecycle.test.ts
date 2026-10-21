/**
 * [POS]: Behaviour tests of the window lifecycle — wake-up queue replay, the rebuild budget, generation discard, duplicate/out-of-order events, browser-restart recovery (#11 matrix rows 1/6/7/8/9/11)
 */
import { describe, expect, it } from 'vitest';
import { flush, setupKernel } from './fake-chrome';

const W = 1;
const W2 = 2;
const A = 2;

describe('background wake-up', () => {
  it('decides a wake-up creation from the event opener and the restored chain, moving once (#11 row 1)', async () => {
    const kit = setupKernel({ session: { [W]: { lastActive: A, children: { [A]: [21] } } } });
    kit.world.seed(W, [1, A, 21, 3]);
    kit.world.parkQueries();

    const placed = kit.create(kit.world.open(W, 22, { opener: A, active: true }));
    await kit.drain();

    expect(await placed).toEqual({ status: 'applied', tabId: 22, index: 3 });
    expect(kit.world.calls.move).toHaveLength(1);
    expect(kit.world.layout(W)).toEqual([1, A, 21, 22, 3]);
  });

  it('queues events that arrive during the rebuild and replays them in receipt order', async () => {
    const kit = setupKernel({ session: { [W]: { lastActive: 1, children: {} } } });
    kit.world.seed(W, [1, A, 3]);
    kit.world.parkQueries();

    void kit.activate(W, A);
    const placed = kit.create(kit.world.open(W, 30, { active: true }));
    await kit.drain();

    expect(await placed).toEqual({ status: 'applied', tabId: 30, index: 2 });
    expect(kit.world.layout(W)).toEqual([1, A, 30, 3]);
  });

  it('drops session-record tabs that no longer exist in the window', async () => {
    const kit = setupKernel({ session: { [W]: { lastActive: 99, children: {} } } });
    kit.world.seed(W, [1, A, 3]);

    const result = await kit.create(kit.world.open(W, 30));

    expect(result).toEqual({ status: 'skipped', reason: 'anchor-unavailable' });
  });
});

describe('rebuild limits and generations', () => {
  it('skips with rebuild-timeout after 1 s, then rebuilds with a new generation on the next event (#11 row 6)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    kit.world.parkQueries();

    const first = kit.create(kit.world.open(W, 30, { opener: A }));
    await kit.clock.advance(1000);
    expect(await first).toEqual({ status: 'skipped', reason: 'rebuild-timeout' });

    kit.world.releaseQuery();
    const second = kit.create(kit.world.open(W, 31, { opener: A }));
    await kit.drain();

    expect(await second).toEqual({ status: 'applied', tabId: 31, index: 2 });
    expect(kit.world.calls.move).toEqual([{ tabId: 31, index: 2 }]);
  });

  it('gives up a placement whose own snapshot query exceeds the remaining budget', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    kit.world.parkQueries();

    const placed = kit.create(kit.world.open(W, 30, { opener: A }));
    await kit.clock.advance(900);
    kit.world.releaseQuery();
    await flush();
    await kit.clock.advance(200);

    expect(await placed).toEqual({ status: 'skipped', reason: 'rebuild-timeout' });
    expect(kit.world.calls.move).toEqual([]);
  });

  it('reports a failed window query as failed, not as a skip', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A]);
    kit.world.parkQueries();

    const placed = kit.create(kit.world.open(W, 30, { opener: A }));
    await flush();
    kit.world.failQuery();

    expect(await placed).toEqual({ status: 'failed', reason: 'window-query-failed' });
  });

  it('discards the result of a query for a window closed meanwhile (#11 row 7)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A]);
    kit.world.parkQueries();

    const placed = kit.create(kit.world.open(W, 30, { opener: A }));
    await kit.submit({ type: 'window-removed', windowId: W });
    await kit.drain();

    expect(await placed).toEqual({ status: 'skipped', reason: 'window-closed' });
    expect(kit.world.calls.move).toEqual([]);
  });

  it('discards a stale generation that answers after a newer rebuild (#11 row 7)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    kit.world.parkQueries();

    void kit.create(kit.world.open(W, 30, { opener: A }));
    await kit.clock.advance(1000);
    void kit.activate(W, A);
    kit.world.releaseQuery({ newest: true });
    await flush();
    kit.world.releaseQuery();
    kit.world.resumeQueries();
    const placed = await kit.create(kit.world.open(W, 31));

    // Had the stale snapshot been applied, the activation of A would have been lost.
    expect(placed).toEqual({ status: 'applied', tabId: 31, index: 2 });
  });

  it('rebuilds two windows independently, without blocking or sharing data (#11 row 9)', async () => {
    const kit = setupKernel({ session: { [W]: { lastActive: 1, children: {} }, [W2]: { lastActive: 8, children: {} } } });
    kit.world.seed(W, [1, A]);
    kit.world.seed(W2, [7, 8, 9]);
    kit.world.parkQueries();

    const inFirst = kit.create(kit.world.open(W, 30));
    const inSecond = kit.create(kit.world.open(W2, 40));
    await flush();
    kit.world.resumeQueries();
    kit.world.releaseQuery({ windowId: W2 });

    expect(await inSecond).toEqual({ status: 'applied', tabId: 40, index: 2 });
    kit.world.releaseQuery({ windowId: W });
    expect(await inFirst).toEqual({ status: 'applied', tabId: 30, index: 1 });
    expect(kit.world.layout(W)).toEqual([1, 30, A]);
    expect(kit.world.layout(W2)).toEqual([7, 8, 40, 9]);
  });
});

describe('duplicate and out-of-order events', () => {
  it('handles a creation delivered twice as one operation (#11 row 8)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    const tab = kit.world.open(W, 30, { opener: A });
    kit.world.parkQueries();

    const first = kit.create(tab);
    const second = kit.create(tab);
    await kit.drain();

    expect(await first).toEqual({ status: 'applied', tabId: 30, index: 2 });
    expect(await second).toEqual({ status: 'skipped', reason: 'duplicate' });
    expect(kit.world.calls.move).toHaveLength(1);
    kit.world.resumeQueries();
    await kit.create(kit.world.open(W, 31, { opener: A }));
    expect(kit.world.layout(W)).toEqual([1, A, 30, 31, 3]);
  });

  it('skips a tab closed before its placement could run', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A]);
    kit.world.parkQueries();

    const placed = kit.create(kit.world.open(W, 30, { opener: A }));
    kit.world.close(30);
    void kit.submit({ type: 'removed', tabId: 30, windowId: W, isWindowClosing: false });
    await kit.drain();

    expect(await placed).toEqual({ status: 'skipped', reason: 'tab-closed' });
    expect(kit.world.calls.move).toEqual([]);
  });

  it('keeps a Chrome move failure distinct from a vanished tab', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    kit.world.adapter.move = async () => {
      throw new Error('Tabs cannot be edited right now');
    };

    const failed = await kit.create(kit.world.open(W, 30, { opener: A }));
    kit.world.adapter.move = async () => ({ status: 'not-found' });
    const vanished = await kit.create(kit.world.open(W, 31, { opener: A }));

    expect(failed).toEqual({ status: 'failed', reason: 'move-failed', error: 'Tabs cannot be edited right now' });
    expect(vanished).toEqual({ status: 'skipped', reason: 'tab-closed' });
  });
});

describe('browser restart', () => {
  it('leaves a restore batch untouched and records neither chain nor active tab (#11 row 11)', async () => {
    const kit = setupKernel();
    const batch = [10, 11, 12, 13];

    const results = [];
    for (const id of batch) {
      results.push(await kit.create(kit.world.open(W, id, { active: id === 12 })));
    }

    expect(results.every(result => result.status === 'skipped' && result.reason === 'anchor-unavailable')).toBe(true);
    expect(kit.world.calls.move).toEqual([]);
    expect(kit.world.layout(W)).toEqual(batch);
    const record = kit.session.records.get(W);
    expect(record?.lastActive ?? null).toBeNull();
    expect(record?.children ?? {}).toEqual({});
  });
});
