/**
 * [POS]: Where the toolbar icon PNGs live — one path scheme for the icon build step, the manifest, the icon controller and the popup/options headers
 */
import type { RunState } from './run-state';

export const ICON_SIZES = [16, 32, 48, 128] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export const iconPath = (state: RunState, size: IconSize): string => `icons/icon-${state}-${size}.png`;

// Every size of one state, in the shape manifest `icons` and chrome.action.setIcon take.
export const iconPathsFor = (state: RunState): Record<IconSize, string> => ({
  16: iconPath(state, 16),
  32: iconPath(state, 32),
  48: iconPath(state, 48),
  128: iconPath(state, 128),
});
