/**
 * [POS]: Tests of the debug log box text formatting
 */
import { describe, expect, it } from 'vitest';
import { formatDebugLogs } from '../format-debug-logs';

describe('formatDebugLogs', () => {
  it('shows the empty-state hint when there are no entries', () => {
    expect(formatDebugLogs([])).toBe('暂无日志。请打开新标签页后再刷新。');
  });

  it('formats each entry as [time][hyp] loc then an indented msg: data line', () => {
    const entries = [{ ts: 0, loc: 'a.ts:1', msg: 'did thing', data: { x: 1 }, hyp: 'A' }];
    const output = formatDebugLogs(entries);
    expect(output).toContain('[A] a.ts:1');
    expect(output).toContain('did thing: {"x":1}');
  });

  it('separates multiple entries with a blank line', () => {
    const entries = [
      { ts: 0, loc: 'a', msg: 'm1', hyp: 'A' },
      { ts: 1, loc: 'b', msg: 'm2', hyp: 'B' },
    ];
    expect(formatDebugLogs(entries).split('\n\n')).toHaveLength(2);
  });
});
