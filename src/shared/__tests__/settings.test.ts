/**
 * [POS]: Tests of settings normalisation and defaults
 */
import { describe, expect, it } from 'vitest';
import { normalizeSettings, SETTINGS_DEFAULTS } from '../settings';

describe('SETTINGS_DEFAULTS', () => {
  it('only has enabled and pause_until', () => {
    expect(SETTINGS_DEFAULTS).toEqual({ enabled: true, pause_until: null });
  });
});

describe('normalizeSettings', () => {
  it('fills defaults for a first-install read with no keys', () => {
    expect(normalizeSettings({})).toEqual({ enabled: true, pause_until: null });
  });

  it('fills defaults for null/undefined input', () => {
    expect(normalizeSettings(null)).toEqual({ enabled: true, pause_until: null });
    expect(normalizeSettings(undefined)).toEqual({ enabled: true, pause_until: null });
  });

  it('preserves a valid enabled/pause_until pair', () => {
    expect(normalizeSettings({ enabled: false, pause_until: 12345 })).toEqual({
      enabled: false,
      pause_until: 12345,
    });
  });

  it('falls back to defaults for malformed field types', () => {
    expect(normalizeSettings({ enabled: 'nope', pause_until: 'nope' })).toEqual({
      enabled: true,
      pause_until: null,
    });
  });

  it('ignores legacy fields still present in raw storage', () => {
    const raw = { enabled: true, pause_until: null, disabled_hosts: ['x'], inherit_group: false } as Record<
      string,
      unknown
    >;
    expect(normalizeSettings(raw)).toEqual({ enabled: true, pause_until: null });
  });
});
