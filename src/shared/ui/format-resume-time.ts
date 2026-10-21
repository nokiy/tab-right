/**
 * [POS]: Pure formatter for the paused state's resume timestamp, shared by popup/options
 */
// Formats a pause_until timestamp as "HH:MM 恢复" in the viewer's local time — the
// wording of the paused state.
export const formatResumeTime = (pauseUntil: number): string => {
  const date = new Date(pauseUntil);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} 恢复`;
};
