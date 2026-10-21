/**
 * [POS]: Shortcut section of the options page — current binding of the new-tab-right command and the entry-point capability notes
 */
import { useEffect, useState } from 'react';
import { describeShortcutBinding } from '../shortcut-binding';
import type { ShortcutStatus } from '../shortcut-binding';

const openShortcutsPage = () => {
  void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
};

export const ShortcutSection = () => {
  const [status, setStatus] = useState<ShortcutStatus | null>(null);

  useEffect(() => {
    // chrome.commands exists only while the manifest declares `commands`; without it
    // the command is reported as unbound.
    if (!chrome.commands?.getAll) {
      setStatus({ bound: false, shortcut: null });
      return;
    }
    void chrome.commands.getAll().then(commands => setStatus(describeShortcutBinding(commands)));
  }, []);

  return (
    <div className="tr-card">
      <div className="tr-row">
        <span className="tr-row__text">
          <span className="tr-row__title">快捷键</span>
          <span className="tr-row__desc">
            「在右侧新建标签」当前绑定：{status === null ? '读取中…' : status.bound ? status.shortcut : '未绑定'}
          </span>
        </span>
        {status !== null && !status.bound && (
          <button className="tr-segmented__btn" onClick={openShortcutsPage} type="button">
            去设置
          </button>
        )}
      </div>
      <div className="tr-row tr-row--note">
        <span className="tr-row__desc">
          链接类入口（前台/中键/右键打开）原生即就位；「在右侧新建标签」命令一出生就在正确位置。原生 Command+T、加号、书签、外部拉起是创建后再移动，会有短暂的末尾滑回，可用系统「减少动态效果」消除。
        </span>
      </div>
      <div className="tr-row tr-row--note">
        <span className="tr-row__desc">
          把系统 Command+T 手动绑定到本命令是可选增强，未经验证：可能绑不进、绑了不触发，或与原生 Command+T
          同时生效造成双开新标签。出现双开时请到 chrome://extensions/shortcuts 解绑本命令，扩展不会自动处理。
        </span>
      </div>
    </div>
  );
};
