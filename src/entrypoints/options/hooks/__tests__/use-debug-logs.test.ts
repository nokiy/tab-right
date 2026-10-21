// @vitest-environment jsdom
/**
 * [POS]: Tests of the debug log panel hook — no read while collapsed, refresh/copy with inline status
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebugLogs } from '../use-debug-logs';

const fakeLogs = [{ ts: 1, loc: 'a', msg: 'b', hyp: 'A' }];

const fakeStorage = (data: Record<string, unknown>) => ({
  get: vi.fn(async (keys: string[]) => Object.fromEntries(keys.filter(k => k in data).map(k => [k, data[k]]))),
});

const fakeClipboard = () => ({ writeText: vi.fn(async () => {}) });

describe('useDebugLogs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not read storage while collapsed', () => {
    const storage = fakeStorage({ _debug_logs: fakeLogs });
    renderHook(() => useDebugLogs(false, storage, fakeClipboard()));

    expect(storage.get).not.toHaveBeenCalled();
  });

  it('reads storage once expanded', async () => {
    const storage = fakeStorage({ _debug_logs: fakeLogs });
    const { result, rerender } = renderHook(({ expanded }) => useDebugLogs(expanded, storage, fakeClipboard()), {
      initialProps: { expanded: false },
    });

    rerender({ expanded: true });
    await act(async () => {
      await Promise.resolve();
    });

    expect(storage.get).toHaveBeenCalledTimes(1);
    expect(result.current.logs).toEqual(fakeLogs);
  });

  it('refresh sets status to refreshed, then clears it after the timeout', async () => {
    const storage = fakeStorage({ _debug_logs: fakeLogs });
    const { result } = renderHook(() => useDebugLogs(true, storage, fakeClipboard()));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe('refreshed');

    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(result.current.status).toBe('idle');
  });

  it('copy writes the loaded logs as JSON to the clipboard and sets status copied, without alert', async () => {
    const storage = fakeStorage({ _debug_logs: fakeLogs });
    const clipboard = fakeClipboard();
    const alertSpy = vi.spyOn(window, 'alert');
    const { result } = renderHook(() => useDebugLogs(true, storage, clipboard));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.copy();
    });

    expect(clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(fakeLogs, null, 2));
    expect(result.current.status).toBe('copied');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('copy reads first when logs were never loaded (collapsed panel)', async () => {
    const storage = fakeStorage({ _debug_logs: fakeLogs });
    const clipboard = fakeClipboard();
    const { result } = renderHook(() => useDebugLogs(false, storage, clipboard));

    await act(async () => {
      await result.current.copy();
    });

    expect(storage.get).toHaveBeenCalledTimes(1);
    expect(clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(fakeLogs, null, 2));
  });
});
