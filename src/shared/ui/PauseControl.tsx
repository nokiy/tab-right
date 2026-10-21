/**
 * [POS]: 15/30/60-minute pause control — shared by popup/options, no permanent pause
 */
import type { RunState } from '../run-state';
import { formatResumeTime } from './format-resume-time';

export const PAUSE_DURATIONS_MINUTES = [15, 30, 60] as const;
export type PauseDurationMinutes = (typeof PAUSE_DURATIONS_MINUTES)[number];

type PauseControlProps = {
  runState: RunState;
  pauseUntil: number | null;
  onPause: (minutes: PauseDurationMinutes) => void;
  onResume: () => void;
};

// Follows the shared RunState: the resume view only while actually paused, and every
// button disabled while the extension is off.
export const PauseControl = ({ runState, pauseUntil, onPause, onResume }: PauseControlProps) => {
  if (runState === 'paused' && pauseUntil !== null) {
    return (
      <div className="tr-pause-active">
        <span className="tr-pause-active__time">{formatResumeTime(pauseUntil)}</span>
        <button className="tr-btn-resume" onClick={onResume} type="button">
          立即恢复
        </button>
      </div>
    );
  }

  return (
    <div className="tr-segmented">
      {PAUSE_DURATIONS_MINUTES.map(minutes => (
        <button
          className="tr-segmented__btn"
          disabled={runState === 'off'}
          key={minutes}
          onClick={() => onPause(minutes)}
          type="button"
        >
          {minutes < 60 ? `${minutes} 分钟` : '1 小时'}
        </button>
      ))}
    </div>
  );
};
