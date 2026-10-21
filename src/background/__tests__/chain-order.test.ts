/**
 * [POS]: Behaviour tests of consecutive-open order and target index — #11 matrix rows 2/3/4/5/10/12/13, groups, cross-window and identity
 */
import { describe, expect, it } from 'vitest';
import { setupKernel } from './fake-chrome';

const W = 1;
const OTHER = 2;
const A = 2;

// Opens A1, A2 from A with Chrome dropping each one right next to A (foreground link).
const openChain = async (kit: ReturnType<typeof setupKernel>, ids: number[]) => {
  for (const id of ids) {
    await kit.create(kit.world.open(W, id, { index: kit.world.layout(W).indexOf(A) + 1, opener: A }));
  }
};

describe('consecutive opening from one anchor', () => {
  it('keeps A → A1 → A2 → A3 order when Chrome drops each new tab right of A', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);

    await openChain(kit, [21, 22, 23]);

    expect(kit.world.layout(W)).toEqual([1, A, 21, 22, 23, 3]);
  });

  it('puts A3 after A1 when A2 was dragged far away (#11 row 4)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3, 4]);
    await openChain(kit, [21, 22]);
    kit.world.drag(22, 5);

    await openChain(kit, [23]);

    expect(kit.world.layout(W)).toEqual([1, A, 21, 23, 3, 4, 22]);
  });

  it('puts A3 after A2 when A1 was closed (#11 row 4)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    await openChain(kit, [21, 22]);
    kit.world.close(21);
    await kit.submit({ type: 'removed', tabId: 21, windowId: W, isWindowClosing: false });

    await openChain(kit, [23]);

    expect(kit.world.layout(W)).toEqual([1, A, 22, 23, 3]);
  });

  it('puts A3 after A1 when A2 moved to another window (#11 row 4)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    kit.world.seed(OTHER, [9]);
    await openChain(kit, [21, 22]);
    kit.world.transfer(22, OTHER);
    await kit.submit({ type: 'detached', tabId: 22, windowId: W });
    await kit.submit({ type: 'attached', tabId: 22, windowId: OTHER });

    await openChain(kit, [23]);

    expect(kit.world.layout(W)).toEqual([1, A, 21, 23, 3]);
    expect(kit.world.layout(OTHER)).toEqual([9, 22]);
  });

  it('leaves a background link Chrome already placed in order alone, yet counts it in the chain (#11 row 5)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);

    const first = await kit.create(kit.world.open(W, 21, { index: 2, opener: A }));
    const second = await kit.create(kit.world.open(W, 22, { index: 3, opener: A }));
    await kit.create(kit.world.open(W, 23, { index: 2, opener: A }));

    expect(first).toEqual({ status: 'skipped', reason: 'native-correct' });
    expect(second).toEqual({ status: 'skipped', reason: 'native-correct' });
    expect(kit.world.calls.move).toEqual([{ tabId: 23, index: 4 }]);
    expect(kit.world.layout(W)).toEqual([1, A, 21, 22, 23, 3]);
  });

  it('counts only direct children: A, A1, A2, A3 grandchain then A4 from A gives A, A1, A4, A2, A3 (#11 row 12)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [A, 9]);
    await kit.create(kit.world.open(W, 21, { index: 1, opener: A }));
    await kit.create(kit.world.open(W, 22, { index: 2, opener: 21 }));
    await kit.create(kit.world.open(W, 23, { index: 3, opener: 22 }));

    await kit.create(kit.world.open(W, 24, { index: 1, opener: A }));

    expect(kit.world.layout(W)).toEqual([A, 21, 24, 22, 23, 9]);
  });

  it('moves a new tab that Chrome put left of its anchor to the right of it', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, 2, 3, A + 10]);

    await kit.create(kit.world.open(W, 30, { index: 0, opener: A + 10 }));

    expect(kit.world.layout(W)).toEqual([1, 2, 3, A + 10, 30]);
  });
});

describe('anchor without an opener', () => {
  it('uses the pre-creation active tab, unpolluted by the new tab’s own activation (#11 row 2)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    await kit.activate(W, A);

    const result = await kit.create(kit.world.open(W, 30, { active: true }));
    await kit.create(kit.world.open(W, 31, { active: false }));

    expect(result).toEqual({ status: 'applied', tabId: 30, index: 2 });
    expect(kit.world.layout(W)).toEqual([1, A, 30, 31, 3]);
  });

  it('places two plus-button tabs in a row as A, N1, N2 (#11 row 13)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    await kit.activate(W, A);

    await kit.create(kit.world.open(W, 30, { active: true }));
    await kit.create(kit.world.open(W, 31, { active: true }));

    expect(kit.world.layout(W)).toEqual([1, A, 30, 31, 3]);
  });

  it('leaves the tab where Chrome put it when neither opener nor record exists (#11 row 3)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);

    const result = await kit.create(kit.world.open(W, 30, { active: true }));

    expect(result).toEqual({ status: 'skipped', reason: 'anchor-unavailable' });
    expect(kit.world.calls.move).toEqual([]);
    expect(kit.world.layout(W)).toEqual([1, A, 3, 30]);
    expect(kit.logs.some(entry => entry.msg === 'anchor-unavailable')).toBe(true);
  });

  it('ignores an opener that lives in another window and falls back to the active record', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);
    kit.world.seed(OTHER, [9]);
    await kit.activate(W, 1);

    await kit.create(kit.world.open(W, 30, { opener: 9 }));

    expect(kit.world.layout(W)).toEqual([1, 30, A, 3]);
  });
});

describe('target position boundaries', () => {
  it('clamps a target inside the pinned zone to the first unpinned index (#11 row 10)', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, 2, 3, 4], [1, 2, 3]);

    await kit.create(kit.world.open(W, 30, { opener: 1 }));
    await kit.create(kit.world.open(W, 31, { opener: 1 }));

    expect(kit.world.layout(W)).toEqual([1, 2, 3, 30, 31, 4]);
  });

  it('lets the new tab join the anchor’s group without touching the group', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3, 4]);
    for (const id of [A, 3]) kit.world.setGroup(id, 7);

    const result = await kit.create(kit.world.open(W, 30, { opener: A }));

    expect(result).toEqual({ status: 'applied', tabId: 30, index: 2 });
    expect(kit.world.layout(W)).toEqual([1, A, 30, 3, 4]);
    expect(kit.world.calls.create).toEqual([]);
  });

  it('keeps the tab’s identity: the placed tab is moved, never recreated', async () => {
    const kit = setupKernel();
    kit.world.seed(W, [1, A, 3]);

    await kit.create(kit.world.open(W, 30, { opener: A }));

    expect(kit.world.layout(W)).toContain(30);
    expect(kit.world.calls.create).toEqual([]);
    expect(Object.keys(kit.world.adapter)).not.toContain('remove');
  });
});
