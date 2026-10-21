/**
 * [POS]: Tests of the paused-state resume time formatting
 */
import { describe, expect, it } from 'vitest';
import { formatResumeTime } from '../format-resume-time';

describe('formatResumeTime', () => {
  it('formats a timestamp as zero-padded HH:MM 恢复 in local time', () => {
    const pauseUntil = new Date(2026, 0, 1, 9, 5).getTime();
    expect(formatResumeTime(pauseUntil)).toBe('09:05 恢复');
  });

  it('pads both hour and minute when they are single digits', () => {
    const pauseUntil = new Date(2026, 0, 1, 0, 0).getTime();
    expect(formatResumeTime(pauseUntil)).toBe('00:00 恢复');
  });

  it('does not pad a two-digit hour', () => {
    const pauseUntil = new Date(2026, 0, 1, 23, 59).getTime();
    expect(formatResumeTime(pauseUntil)).toBe('23:59 恢复');
  });
});
