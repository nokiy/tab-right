// @vitest-environment jsdom
/**
 * [POS]: Behaviour tests of the popup/options settings seam — loading and read-failure states, write failure, minimal-field writes, live sync
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSettings } from '../use-settings';
import { createSettingsRepository } from '../../storage/settings-repository';
import { createFakeSettingsArea } from './fake-settings-area';

describe('useSettings before and without a successful read', () => {
  it('reports loading, with no run state, until the first read answers', async () => {
    const area = createFakeSettingsArea({ enabled: false });
    area.holdReads();
    const repository = createSettingsRepository(area);

    const view = renderHook(() => useSettings(repository));
    expect(view.result.current.status).toBe('loading');
    expect(view.result.current).not.toHaveProperty('runState');

    await act(async () => area.releaseReads());
    expect(view.result.current).toMatchObject({ status: 'loaded', runState: 'off' });
  });

  it('reports a read failure instead of the enabled default', async () => {
    const area = createFakeSettingsArea({});
    area.failReads(new Error('storage down'));
    const repository = createSettingsRepository(area);

    const view = renderHook(() => useSettings(repository));

    await waitFor(() => expect(view.result.current.status).toBe('failed'));
    expect(view.result.current).not.toHaveProperty('runState');
  });

  it('recovers from a read failure on retry', async () => {
    const area = createFakeSettingsArea({ enabled: true });
    area.failReads(new Error('storage down'));
    const repository = createSettingsRepository(area);
    const view = renderHook(() => useSettings(repository));
    await waitFor(() => expect(view.result.current.status).toBe('failed'));

    area.failReads(null);
    await act(async () => {
      if (view.result.current.status === 'failed') view.result.current.retry();
    });

    await waitFor(() => expect(view.result.current).toMatchObject({ status: 'loaded', runState: 'running' }));
  });
});

describe('useSettings writes', () => {
  it('keeps the old value and surfaces an inline error when the write fails', async () => {
    const area = createFakeSettingsArea({ enabled: true });
    area.failWrites(new Error('quota'));
    const repository = createSettingsRepository(area);
    const view = renderHook(() => useSettings(repository));
    await waitFor(() => expect(view.result.current.status).toBe('loaded'));

    await act(async () => {
      if (view.result.current.status === 'loaded') await view.result.current.setEnabled(false);
    });

    expect(view.result.current).toMatchObject({ status: 'loaded', runState: 'running', settings: { enabled: true } });
    expect(view.result.current.status === 'loaded' && view.result.current.writeError).toBeTruthy();
    expect(area.data.enabled).toBe(true);
  });

  it('gives a write failure its own result, distinct from a successful write and from a read failure', async () => {
    const area = createFakeSettingsArea({ enabled: true });
    const repository = createSettingsRepository(area);
    await waitFor(() => expect(repository.getSnapshot().status).toBe('loaded'));

    expect(await repository.update({ enabled: false })).toEqual({ status: 'written' });
    area.failWrites(new Error('quota'));
    const failed = await repository.update({ enabled: true });

    expect(failed.status).toBe('write-failed');
    expect(repository.getSnapshot()).toEqual({ status: 'loaded', settings: { enabled: false, pause_until: null } });
  });

  it('writes only the changed field, so a stale surface never overwrites the other field', async () => {
    const area = createFakeSettingsArea({ enabled: true, pause_until: null });
    const popup = createSettingsRepository(area);
    const options = createSettingsRepository(area);
    await waitFor(() => expect(options.getSnapshot().status).toBe('loaded'));

    // The popup pauses; the options page has not heard about it yet when it toggles.
    area.holdChanges();
    await popup.update({ pause_until: 5000 });
    await options.update({ enabled: false });

    expect(area.data).toEqual({ enabled: false, pause_until: 5000 });
  });

  it('clears the inline error after the next successful write', async () => {
    const area = createFakeSettingsArea({ enabled: true });
    area.failWrites(new Error('quota'));
    const repository = createSettingsRepository(area);
    const view = renderHook(() => useSettings(repository));
    await waitFor(() => expect(view.result.current.status).toBe('loaded'));
    const setEnabled = async (value: boolean) =>
      act(async () => {
        if (view.result.current.status === 'loaded') await view.result.current.setEnabled(value);
      });

    await setEnabled(false);
    area.failWrites(null);
    await setEnabled(false);

    expect(view.result.current).toMatchObject({ status: 'loaded', runState: 'off', writeError: null });
  });
});

describe('useSettings live sync', () => {
  it('shows a change made by one open surface in every other open surface', async () => {
    const area = createFakeSettingsArea({ enabled: true });
    // Each open page owns its own store over the same storage area.
    const popupStore = createSettingsRepository(area);
    const optionsStore = createSettingsRepository(area);
    const popup = renderHook(() => useSettings(popupStore));
    const options = renderHook(() => useSettings(optionsStore));
    await waitFor(() => expect(options.result.current.status).toBe('loaded'));

    await act(async () => {
      if (popup.result.current.status === 'loaded') await popup.result.current.setEnabled(false);
    });

    await waitFor(() => expect(options.result.current).toMatchObject({ status: 'loaded', runState: 'off' }));
  });
});
