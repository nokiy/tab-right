// @vitest-environment jsdom
/**
 * [POS]: Tests of the reduced-motion preference hook
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReducedMotionPreference } from '../use-reduced-motion';

const fakeMatchMedia = (initialMatches: boolean) => {
  let listener: ((event: { matches: boolean }) => void) | null = null;
  const mql = {
    matches: initialMatches,
    addEventListener: vi.fn((_event: string, cb: (event: { matches: boolean }) => void) => {
      listener = cb;
    }),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList;
  return { matchMedia: () => mql, emit: (matches: boolean) => listener?.({ matches }) };
};

describe('useReducedMotionPreference', () => {
  it('reports the initial system preference', () => {
    const { matchMedia } = fakeMatchMedia(true);
    const { result } = renderHook(() => useReducedMotionPreference(matchMedia));
    expect(result.current).toBe(true);
  });

  it('updates when the system preference changes live', () => {
    const { matchMedia, emit } = fakeMatchMedia(false);
    const { result } = renderHook(() => useReducedMotionPreference(matchMedia));
    expect(result.current).toBe(false);

    act(() => emit(true));
    expect(result.current).toBe(true);
  });
});
