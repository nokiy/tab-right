/**
 * [POS]: Status pill (dot + Chinese label) for the current RunState — shared by popup/options
 */
import type { RunState } from '../run-state';
import { formatResumeTime } from './format-resume-time';

type StatusPillProps = {
  state: RunState;
  pauseUntil: number | null;
};

const LABEL: Record<RunState, string> = {
  running: '运行中',
  paused: '已暂停',
  off: '已关闭',
};

export const StatusPill = ({ state, pauseUntil }: StatusPillProps) => {
  const label = state === 'paused' && pauseUntil !== null ? `${LABEL.paused} · ${formatResumeTime(pauseUntil)}` : LABEL[state];

  return (
    <span className={`tr-pill tr-pill--${state}`}>
      <span className="tr-pill__dot" />
      {label}
    </span>
  );
};
