/**
 * [POS]: Popup entrypoint (~300px) — status, enable, pause, link to the options page
 */
import './Popup.css';
import { iconPath } from '@/shared/icon-paths';
import { useSettings } from '@/shared/hooks/use-settings';
import { PauseControl, SettingsUnavailable, StatusPill, SwitchRow, WriteErrorLine } from '@/shared/ui';

export const Popup = () => {
  const view = useSettings();

  return (
    <div className="tr-popup">
      <header className="tr-popup__header">
        <span className="tr-popup__brand">
          <img
            alt=""
            className="tr-popup__icon"
            height={20}
            src={iconPath(view.status === 'loaded' ? view.runState : 'off', 32)}
            width={20}
          />
          <span className="tr-popup__title">Tab_Right</span>
        </span>
        {view.status === 'loaded' && <StatusPill pauseUntil={view.settings.pause_until} state={view.runState} />}
      </header>

      {view.status === 'loaded' ? (
        <div className="tr-card">
          <SwitchRow checked={view.settings.enabled} onChange={view.setEnabled} title="启用 Tab_Right" />
          <div className="tr-row">
            <span className="tr-row__text">
              <span className="tr-row__title">临时暂停</span>
            </span>
            <PauseControl
              onPause={view.pause}
              onResume={view.resume}
              pauseUntil={view.settings.pause_until}
              runState={view.runState}
            />
          </div>
        </div>
      ) : (
        <SettingsUnavailable view={view} />
      )}
      {view.status === 'loaded' && <WriteErrorLine message={view.writeError} />}

      <button className="tr-popup__options-link" onClick={() => chrome.runtime.openOptionsPage()} type="button">
        打开设置页 →
      </button>
    </div>
  );
};
