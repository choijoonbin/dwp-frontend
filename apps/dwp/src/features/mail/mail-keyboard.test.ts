// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { isMailShortcutTargetInteractive } from './mail-keyboard';

describe('mail keyboard shortcut guard', () => {
  it.each(['input', 'textarea', 'select', 'button', 'a', '[role="tab"]', '[role="menuitem"]'])(
    'blocks shortcuts while focus is inside %s',
    (selector) => {
      const root = document.createElement('div');
      const isFormControl = ['input', 'textarea', 'select'].includes(selector);
      root.innerHTML = isFormControl
        ? `<${selector}></${selector}>`
        : selector === 'a'
          ? '<a href="#"><span>target</span></a>'
          : selector.startsWith('[')
            ? `<div ${selector.slice(1, -1)}><span>target</span></div>`
            : `<${selector}><span>target</span></${selector}>`;
      const target = isFormControl ? root.querySelector(selector) : root.querySelector('span');
      expect(isMailShortcutTargetInteractive(target)).toBe(true);
    }
  );

  it('allows shortcuts from non-interactive mail content', () => {
    const content = document.createElement('div');
    expect(isMailShortcutTargetInteractive(content)).toBe(false);
  });
});
