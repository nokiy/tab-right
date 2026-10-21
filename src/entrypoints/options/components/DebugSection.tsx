/**
 * [POS]: Debug log disclosure of the options page — collapsed by default, reads the stored log only once expanded
 */
import { useState } from 'react';
import { formatDebugLogs } from '../format-debug-logs';
import { useDebugLogs } from '../hooks/use-debug-logs';

const STATUS_TEXT = {
  refreshed: (count: number) => `已刷新 · 共 ${count} 条`,
  copied: () => '已复制到剪贴板',
} as const;

export const DebugSection = () => {
  const [expanded, setExpanded] = useState(false);
  const { logs, status, refresh, copy } = useDebugLogs(expanded);

  return (
    <div className="tr-card">
      <button aria-expanded={expanded} className="tr-row tr-disclosure" onClick={() => setExpanded(value => !value)} type="button">
        <span className="tr-row__text">
          <span className="tr-row__title">调试日志</span>
          {!expanded && <span className="tr-row__desc">展开后读取</span>}
        </span>
      </button>
      {expanded && (
        <div className="tr-debug-panel">
          <div className="tr-debug-panel__actions">
            <button className="tr-segmented__btn" onClick={() => void refresh()} type="button">
              刷新日志
            </button>
            <button className="tr-segmented__btn" onClick={() => void copy()} type="button">
              复制日志
            </button>
            {status !== 'idle' && (
              <span className="tr-debug-panel__status">
                {status === 'refreshed' ? STATUS_TEXT.refreshed(logs.length) : STATUS_TEXT.copied()}
              </span>
            )}
          </div>
          <pre className="tr-debug-panel__log tr-mono">{formatDebugLogs(logs)}</pre>
        </div>
      )}
    </div>
  );
};
