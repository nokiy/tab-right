/**
 * [POS]: Debug log panel state — reads chrome.storage.local only once the panel is expanded
 */
import { useCallback, useEffect, useState } from 'react';
import { DEBUG_LOGS_KEY, type DebugLogEntry } from '../../../shared/debug-log-entry';

export type DebugLogStorage = { get(keys: string[]): Promise<Record<string, unknown>> };
export type ClipboardWriter = { writeText(text: string): Promise<void> };

type CopyStatus = 'idle' | 'refreshed' | 'copied';

const STATUS_CLEAR_MS = 2400;

// Reads `_debug_logs` on demand (refresh, or the first time the panel expands) and
// exposes an inline status for refresh/copy instead of a blocking alert().
export const useDebugLogs = (
  expanded: boolean,
  storage: DebugLogStorage = chrome.storage.local,
  clipboard: ClipboardWriter = navigator.clipboard,
) => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<CopyStatus>('idle');

  const showStatusThenClear = useCallback((next: CopyStatus) => {
    setStatus(next);
    window.setTimeout(() => setStatus('idle'), STATUS_CLEAR_MS);
  }, []);

  const refresh = useCallback(async () => {
    const result = await storage.get([DEBUG_LOGS_KEY]);
    const next = (result[DEBUG_LOGS_KEY] as DebugLogEntry[] | undefined) ?? [];
    setLogs(next);
    setLoaded(true);
    showStatusThenClear('refreshed');
    return next;
  }, [showStatusThenClear, storage]);

  const copy = useCallback(async () => {
    const source = loaded ? logs : await refresh();
    await clipboard.writeText(JSON.stringify(source, null, 2));
    showStatusThenClear('copied');
  }, [clipboard, loaded, logs, refresh, showStatusThenClear]);

  useEffect(() => {
    if (expanded && !loaded) {
      void refresh();
    }
  }, [expanded, loaded, refresh]);

  return { logs, status, refresh, copy };
};
