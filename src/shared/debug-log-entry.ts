/**
 * [POS]: Debug log storage contract — written by the background debug-log, read by the options debug panel
 */
// chrome.storage.local key holding the most recent DEBUG_LOG_LIMIT entries.
export const DEBUG_LOGS_KEY = '_debug_logs';
export const DEBUG_LOG_LIMIT = 50;

// `hyp` is the entry's category (e.g. 'kernel', 'lifecycle'); the short field names are
// the stored format and stay as they are.
export type DebugLogEntry = {
  ts: number;
  loc: string;
  msg: string;
  data?: unknown;
  hyp: string;
};
