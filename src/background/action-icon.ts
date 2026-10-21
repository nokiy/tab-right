/**
 * [POS]: Toolbar icon controller — paints the shared RunState on chrome.action and arms the pause-expiry alarm; independent of the placement kernel
 */
import { iconPathsFor } from '../shared/icon-paths';
import { computeRunState, type RunState } from '../shared/run-state';
import { settingsPatchOf } from '../shared/settings';
import { loadSettings } from '../shared/storage/settings-source';

const ALARM_NAME = 'tab-right-pause-expiry';
const TITLE = 'Tab_Right';
const READ_FAILED_TITLE = `${TITLE} · 读取设置失败`;

// Narrow seam over the chrome.* surface this controller touches, so tests can supply a
// fake runtime instead of the real chrome global.
export type ActionIconRuntime = {
  storage: {
    local: { get(keys: string[]): Promise<Record<string, unknown>> };
    onChanged: {
      addListener(callback: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void): void;
    };
  };
  action: {
    setIcon(details: { path: Record<number, string> }): Promise<void> | void;
    setTitle(details: { title: string }): Promise<void> | void;
  };
  alarms: {
    create(name: string, info: { when: number }): Promise<void> | void;
    clear(name: string): Promise<boolean> | void;
    onAlarm: { addListener(callback: (alarm: { name: string }) => void): void };
  };
  runtime: {
    onStartup: { addListener(callback: () => void): void };
    onInstalled: { addListener(callback: () => void): void };
  };
};

// Reads settings, repaints the icon for the resulting RunState, and re-arms the pause
// alarm. A failed read paints the not-running glyph with a failure title — the kernel
// places nothing while settings are unreadable — and the next trigger reads again.
const recompute = async (chromeApi: ActionIconRuntime): Promise<RunState | null> => {
  const result = await loadSettings(chromeApi.storage.local);
  if (result.status === 'failed') {
    await chromeApi.action.setIcon({ path: iconPathsFor('off') });
    await chromeApi.action.setTitle({ title: READ_FAILED_TITLE });
    return null;
  }

  const state = computeRunState(result.settings, Date.now());
  await chromeApi.action.setIcon({ path: iconPathsFor(state) });
  await chromeApi.action.setTitle({ title: TITLE });

  await chromeApi.alarms.clear(ALARM_NAME);
  const pauseUntil = result.settings.pause_until;
  if (typeof pauseUntil === 'number' && pauseUntil > Date.now()) {
    await chromeApi.alarms.create(ALARM_NAME, { when: pauseUntil });
  }

  return state;
};

// Registers every listener synchronously (MV3 requirement: a listener attached after an
// await can miss the event that woke the service worker) and kicks off the first
// recompute so a fresh worker paints the icon before any of those events fire.
export const startActionIcon = (chromeApi: ActionIconRuntime = chrome): void => {
  chromeApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !settingsPatchOf(changes)) {
      return;
    }
    void recompute(chromeApi);
  });

  chromeApi.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_NAME) {
      void recompute(chromeApi);
    }
  });

  chromeApi.runtime.onStartup.addListener(() => void recompute(chromeApi));
  chromeApi.runtime.onInstalled.addListener(() => void recompute(chromeApi));

  void recompute(chromeApi);
};
