/**
 * [POS]: Pure lookup for the new-tab-right command's current binding, from chrome.commands.getAll
 */
import { NEW_TAB_RIGHT_COMMAND } from '../../shared/commands';

export type CommandBinding = { name?: string; shortcut?: string };
export type ShortcutStatus = { bound: boolean; shortcut: string | null };

// A command that exists but was never given a key (or lost it to another extension)
// reports shortcut: "" from chrome.commands.getAll — treat that the same as absent.
export const describeShortcutBinding = (commands: CommandBinding[]): ShortcutStatus => {
  const command = commands.find(entry => entry.name === NEW_TAB_RIGHT_COMMAND);
  const shortcut = command?.shortcut?.trim();
  return shortcut ? { bound: true, shortcut } : { bound: false, shortcut: null };
};
