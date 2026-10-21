/**
 * [POS]: Options page — run settings (status, enable, pause), debug log, shortcut, reduced motion
 */
import './Options.css';
import { withErrorBoundary, withSuspense } from '@/shared';
import type { FallbackProps } from '@/shared';
import { useSettings, type SettingsView } from '@/shared/hooks/use-settings';
import { iconPath } from '@/shared/icon-paths';
import { PauseControl, SettingsUnavailable, StatusPill, SwitchRow, WriteErrorLine } from '@/shared/ui';
import { DebugSection } from './components/DebugSection';
import { ReducedMotionSection } from './components/ReducedMotionSection';
import { ShortcutSection } from './components/ShortcutSection';

const Loading = () => (
  <div className="tr-options">
    <p>加载中…</p>
  </div>
);

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => (
  <div className="tr-options">
    <h1>Tab_Right</h1>
    <p>{error?.message ?? '出现了错误。'}</p>
    <button className="tr-segmented__btn" onClick={resetErrorBoundary} type="button">
      重试
    </button>
  </div>
);

const RunSection = ({ view }: { view: SettingsView }) => {
  if (view.status !== 'loaded') return <SettingsUnavailable view={view} />;

  return (
    <>
      <div className="tr-card">
        <div className="tr-row">
          <span className="tr-row__text">
            <span className="tr-row__title">当前状态</span>
            <span className="tr-row__desc">扩展此刻是否在调整新标签的位置</span>
          </span>
          <StatusPill pauseUntil={view.settings.pause_until} state={view.runState} />
        </div>
        <SwitchRow
          checked={view.settings.enabled}
          description="新标签页在打开它的标签右侧出现"
          onChange={view.setEnabled}
          title="启用 Tab_Right"
        />
        <div className="tr-row">
          <span className="tr-row__text">
            <span className="tr-row__title">临时暂停</span>
            <span className="tr-row__desc">到时间自动恢复</span>
          </span>
          <PauseControl
            onPause={view.pause}
            onResume={view.resume}
            pauseUntil={view.settings.pause_until}
            runState={view.runState}
          />
        </div>
      </div>
      <WriteErrorLine message={view.writeError} />
    </>
  );
};

const OptionsView = () => {
  const view = useSettings();
  const version = chrome.runtime.getManifest().version;

  return (
    <div className="tr-options">
      <header className="tr-options__header">
        <img
          alt=""
          className="tr-options__icon"
          height={28}
          src={iconPath(view.status === 'loaded' ? view.runState : 'off', 32)}
          width={28}
        />
        <span className="tr-options__title">Tab_Right</span>
        <span className="tr-options__version tr-mono">{version}</span>
      </header>

      <h2 className="tr-options__group-title">运行</h2>
      <RunSection view={view} />

      <h2 className="tr-options__group-title">调试</h2>
      <DebugSection />

      <h2 className="tr-options__group-title">快捷键</h2>
      <ShortcutSection />

      <h2 className="tr-options__group-title">减少动态效果</h2>
      <ReducedMotionSection />
    </div>
  );
};

export const Options = withErrorBoundary(withSuspense(OptionsView, <Loading />), ErrorFallback);
