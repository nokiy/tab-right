/**
 * [POS]: The pure RunState function shared by the toolbar icon, popup, options page and placement kernel
 */
import type { Settings } from './types';

// The three states the icon, popup, options page and placement kernel must
// agree on. There is no fourth "loading" product state: a caller without a
// loaded Settings value simply does not call computeRunState yet.
export type RunState = 'off' | 'paused' | 'running';

// Off beats paused: a closed extension is never reported as paused, even with
// a still-future pause_until. Paused holds only while pause_until is a number
// and still in the future; everything else is running.
export const computeRunState = (settings: Settings, now: number): RunState => {
  if (!settings.enabled) {
    return 'off';
  }
  if (typeof settings.pause_until === 'number' && now < settings.pause_until) {
    return 'paused';
  }
  return 'running';
};
