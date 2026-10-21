# src/shared/ui/

React components and styles shared by the popup and the options page. They render a `SettingsView` from `../hooks/use-settings.ts` and never read storage themselves; background code never imports this directory.

## Members
index.ts: barrel.
StatusPill.tsx: dot + label for a RunState (运行中 / 已暂停 · HH:MM 恢复 / 已关闭).
SwitchRow.tsx: titled row with a toggle switch (the enable switch).
PauseControl.tsx: 15 / 30 / 60-minute pause buttons, or the resume view while paused; disabled while off.
SettingsNotice.tsx: `SettingsUnavailable` (loading, or read failure with retry — stands in for every control) and `WriteErrorLine` (inline write-failure message).
format-resume-time.ts: `HH:MM 恢复` formatting of a pause deadline.
tokens.css: light/dark color and font tokens.
components.css: card, row, pill, switch, segmented and notice styles.

