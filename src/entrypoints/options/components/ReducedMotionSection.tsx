/**
 * [POS]: Reduced-motion section of the options page — reports the system preference, never claims every entry point is slide-free
 */
import { useReducedMotionPreference } from '../hooks/use-reduced-motion';

export const ReducedMotionSection = () => {
  const reduced = useReducedMotionPreference();

  return (
    <div className="tr-card">
      <div className="tr-row">
        <span className="tr-row__text">
          <span className="tr-row__title">减少动态效果</span>
          <span className="tr-row__desc">
            当前系统偏好：{reduced ? '已开启' : '未开启'}。这是 macOS 的系统设置（系统设置 → 辅助功能 →
            动态效果），会影响 Chrome 与所有网页的动画，不是 Tab_Right 的开关，本页无法直接更改它。
          </span>
        </span>
      </div>
      <div className="tr-row tr-row--note">
        <span className="tr-row__desc">
          开启后可以消除原生 Command+T、加号、书签、外部拉起这几个入口创建后再移动标签位置时的可见滑动；「在右侧新建标签」命令本身出生即就位，不受此设置影响。未逐一生产实测的入口不在此保证范围内。
        </span>
      </div>
    </div>
  );
};
