/**
 * [POS]: Behaviour tests of the toolbar icon controller — three RunState glyphs, pause-expiry alarm, read failure never shown as running
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startActionIcon } from '../action-icon';
import type { ActionIconRuntime } from '../action-icon';

// Lets the recompute() promise chain (loadSettings -> setIcon -> alarms.clear/create)
// settle across its several microtask hops before assertions run.
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

type FakeRuntime = ActionIconRuntime & {
  data: Record<string, unknown>;
  emitStorageChange: (changes: Record<string, { newValue?: unknown }>, areaName?: string) => void;
  emitAlarm: (name: string) => void;
};

const fakeRuntime = (initial: Record<string, unknown>): FakeRuntime => {
  const data = { ...initial };
  let storageListener: ((changes: Record<string, { newValue?: unknown }>, areaName: string) => void) | null = null;
  let alarmListener: ((alarm: { name: string }) => void) | null = null;

  return {
    data,
    storage: {
      local: { get: async () => ({ ...data }) },
      onChanged: {
        addListener: cb => {
          storageListener = cb;
        },
      },
    },
    action: { setIcon: vi.fn(), setTitle: vi.fn() },
    alarms: {
      create: vi.fn(),
      clear: vi.fn(async () => true),
      onAlarm: {
        addListener: cb => {
          alarmListener = cb;
        },
      },
    },
    runtime: {
      onStartup: { addListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
    },
    emitStorageChange: (changes, areaName = 'local') => {
      storageListener?.(changes, areaName);
    },
    emitAlarm: name => {
      alarmListener?.({ name });
    },
  };
};

describe('startActionIcon', () => {
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  it('paints the running icon on start when enabled and not paused', async () => {
    const runtime = fakeRuntime({ enabled: true, pause_until: null });
    startActionIcon(runtime);
    await flush();

    expect(runtime.action.setIcon).toHaveBeenCalledWith({
      path: { 16: 'icons/icon-running-16.png', 32: 'icons/icon-running-32.png', 48: 'icons/icon-running-48.png', 128: 'icons/icon-running-128.png' },
    });
    expect(runtime.alarms.create).not.toHaveBeenCalled();
  });

  it('paints the off icon when disabled', async () => {
    const runtime = fakeRuntime({ enabled: false, pause_until: null });
    startActionIcon(runtime);
    await flush();

    expect(runtime.action.setIcon).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ 16: 'icons/icon-off-16.png' }) }),
    );
  });

  it('schedules an alarm at pause_until when paused, and paints the paused icon', async () => {
    const pauseUntil = now + 60_000;
    const runtime = fakeRuntime({ enabled: true, pause_until: pauseUntil });
    startActionIcon(runtime);
    await flush();

    expect(runtime.action.setIcon).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ 16: 'icons/icon-paused-16.png' }) }),
    );
    expect(runtime.alarms.create).toHaveBeenCalledWith('tab-right-pause-expiry', { when: pauseUntil });
  });

  it('recomputes and repaints when enabled/pause_until change in local storage', async () => {
    const runtime = fakeRuntime({ enabled: true, pause_until: null });
    startActionIcon(runtime);
    await flush();
    vi.mocked(runtime.action.setIcon).mockClear();

    runtime.data.enabled = false;
    runtime.emitStorageChange({ enabled: { newValue: false } });
    await flush();

    expect(runtime.action.setIcon).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ 16: 'icons/icon-off-16.png' }) }),
    );
  });

  it('ignores storage changes outside the local area', async () => {
    const runtime = fakeRuntime({ enabled: true, pause_until: null });
    startActionIcon(runtime);
    await flush();
    vi.mocked(runtime.action.setIcon).mockClear();

    runtime.emitStorageChange({ enabled: { newValue: false } }, 'sync');
    await flush();

    expect(runtime.action.setIcon).not.toHaveBeenCalled();
  });

  it('ignores local storage changes unrelated to enabled/pause_until', async () => {
    const runtime = fakeRuntime({ enabled: true, pause_until: null });
    startActionIcon(runtime);
    await flush();
    vi.mocked(runtime.action.setIcon).mockClear();

    runtime.emitStorageChange({ _debug_logs: { newValue: [] } });
    await flush();

    expect(runtime.action.setIcon).not.toHaveBeenCalled();
  });

  it('resumes to running when the pause-expiry alarm fires after the deadline, even after a cold worker', async () => {
    const pauseUntil = now + 60_000;
    const runtime = fakeRuntime({ enabled: true, pause_until: pauseUntil });
    startActionIcon(runtime);
    await flush();
    vi.mocked(runtime.action.setIcon).mockClear();

    now = pauseUntil + 1; // time passed while the service worker was asleep
    runtime.emitAlarm('tab-right-pause-expiry');
    await flush();

    expect(runtime.action.setIcon).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ 16: 'icons/icon-running-16.png' }) }),
    );
  });

  it('ignores alarms with an unrelated name', async () => {
    const runtime = fakeRuntime({ enabled: true, pause_until: null });
    startActionIcon(runtime);
    await flush();
    vi.mocked(runtime.action.setIcon).mockClear();

    runtime.emitAlarm('some-other-alarm');
    await flush();

    expect(runtime.action.setIcon).not.toHaveBeenCalled();
  });

  it('shows the not-running glyph and a failure title, never running, when the settings read fails', async () => {
    const runtime = fakeRuntime({ enabled: true, pause_until: null });
    runtime.storage.local.get = async () => {
      throw new Error('storage unavailable');
    };

    expect(() => startActionIcon(runtime)).not.toThrow();
    await flush();

    expect(runtime.action.setIcon).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ 16: 'icons/icon-off-16.png' }) }),
    );
    expect(runtime.action.setTitle).toHaveBeenCalledWith({ title: 'Tab_Right · 读取设置失败' });
  });

  it('restores the plain title once a later read succeeds', async () => {
    const runtime = fakeRuntime({ enabled: true, pause_until: null });
    const read = runtime.storage.local.get;
    runtime.storage.local.get = async () => {
      throw new Error('storage unavailable');
    };
    startActionIcon(runtime);
    await flush();

    runtime.storage.local.get = read;
    runtime.emitStorageChange({ enabled: { newValue: true } });
    await flush();

    expect(runtime.action.setIcon).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ 16: 'icons/icon-running-16.png' }) }),
    );
    expect(runtime.action.setTitle).toHaveBeenLastCalledWith({ title: 'Tab_Right' });
  });
});
