/**
 * [POS]: Tests of the shared RunState function — off beats paused, pause expiry at the current time
 */
import { describe, expect, it } from 'vitest';
import { computeRunState } from '../run-state';
import type { Settings } from '../types';

describe('computeRunState', () => {
  it('is off when disabled, regardless of pause_until', () => {
    const settings: Settings = { enabled: false, pause_until: Date.now() + 60_000 };
    expect(computeRunState(settings, Date.now())).toBe('off');
  });

  it('is paused when enabled and pause_until is still in the future', () => {
    const now = 1_000_000;
    const settings: Settings = { enabled: true, pause_until: now + 1 };
    expect(computeRunState(settings, now)).toBe('paused');
  });

  it('is running when enabled and pause_until has passed', () => {
    const now = 1_000_000;
    const settings: Settings = { enabled: true, pause_until: now - 1 };
    expect(computeRunState(settings, now)).toBe('running');
  });

  it('is running when enabled and pause_until is null', () => {
    const settings: Settings = { enabled: true, pause_until: null };
    expect(computeRunState(settings, Date.now())).toBe('running');
  });

  it('treats now equal to pause_until as no longer paused', () => {
    const now = 1_000_000;
    const settings: Settings = { enabled: true, pause_until: now };
    expect(computeRunState(settings, now)).toBe('running');
  });
});
