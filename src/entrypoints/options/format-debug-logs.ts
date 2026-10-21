/**
 * [POS]: Pure text formatting for the debug log box
 */
import type { DebugLogEntry } from '../../shared/debug-log-entry';

const formatEntry = (entry: DebugLogEntry): string => {
  const time = new Date(entry.ts).toLocaleTimeString();
  return `[${time}][${entry.hyp}] ${entry.loc}\n  ${entry.msg}: ${JSON.stringify(entry.data)}`;
};

export const formatDebugLogs = (logs: DebugLogEntry[]): string =>
  logs.length === 0 ? '暂无日志。请打开新标签页后再刷新。' : logs.map(formatEntry).join('\n\n');
