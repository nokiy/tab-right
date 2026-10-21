/**
 * [POS]: Settings availability notices shared by popup/options — loading, read failure with retry, and the inline write-failure line
 */
import type { SettingsView } from '../hooks/use-settings';

type UnavailableView = Exclude<SettingsView, { status: 'loaded' }>;

// Stands in for every settings control until a read succeeds: nothing is shown as
// running, off or paused on an assumed default.
export const SettingsUnavailable = ({ view }: { view: UnavailableView }) => (
  <div className="tr-card">
    <div className="tr-row">
      {view.status === 'loading' ? (
        <span className="tr-row__desc">读取设置中…</span>
      ) : (
        <>
          <span className="tr-notice--error" role="alert">
            读取设置失败，当前状态未知
          </span>
          <button className="tr-segmented__btn" onClick={view.retry} type="button">
            重试
          </button>
        </>
      )}
    </div>
  </div>
);

export const WriteErrorLine = ({ message }: { message: string | null }) =>
  message === null ? null : (
    <p className="tr-notice--error" role="alert">
      {message}
    </p>
  );
