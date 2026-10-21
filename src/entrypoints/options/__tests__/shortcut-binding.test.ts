/**
 * [POS]: Tests of the new-tab-right command binding lookup
 */
import { describe, expect, it } from 'vitest';
import { describeShortcutBinding } from '../shortcut-binding';

describe('describeShortcutBinding', () => {
  it('reports bound with the current shortcut when the command has one', () => {
    const result = describeShortcutBinding([{ name: 'new-tab-right', shortcut: 'MacCtrl+T' }]);
    expect(result).toEqual({ bound: true, shortcut: 'MacCtrl+T' });
  });

  it('reports unbound when the command is absent from the list', () => {
    const result = describeShortcutBinding([{ name: 'some-other-command', shortcut: 'Alt+X' }]);
    expect(result).toEqual({ bound: false, shortcut: null });
  });

  it('reports unbound when the command exists with an empty shortcut', () => {
    const result = describeShortcutBinding([{ name: 'new-tab-right', shortcut: '' }]);
    expect(result).toEqual({ bound: false, shortcut: null });
  });

  it('reports unbound for an empty command list', () => {
    expect(describeShortcutBinding([])).toEqual({ bound: false, shortcut: null });
  });
});
