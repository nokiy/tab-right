/**
 * [POS]: The background's only log sink — appends {ts, loc, msg, data?, hyp} entries to storage.local, keeping the most recent ones for the options debug panel
 */
import { DEBUG_LOG_LIMIT, DEBUG_LOGS_KEY, type DebugLogEntry } from '../shared/debug-log-entry';

const DEBUG_LOGS: DebugLogEntry[] = [];

export const debugLog = (location: string, message: string, data: unknown, category: string) => {
  const entry: DebugLogEntry = { ts: Date.now(), loc: location, msg: message, data, hyp: category };
  DEBUG_LOGS.push(entry);
  console.log(`[DEBUG][${category}] ${location}: ${message}`, JSON.stringify(data));
  chrome.storage.local.set({ [DEBUG_LOGS_KEY]: DEBUG_LOGS.slice(-DEBUG_LOG_LIMIT) });
};
