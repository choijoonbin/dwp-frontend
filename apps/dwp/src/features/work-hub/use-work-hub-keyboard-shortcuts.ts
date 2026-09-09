import { useEffect, useRef } from 'react';

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

type WorkKeyboardCommands = {
  onCreate?: () => void;
  onComplete?: () => void;
  onEdit?: () => void;
};

const EDITING_OR_WIDGET = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  ':disabled',
  '[aria-disabled="true"]',
].join(',');

function shortcutBlocked(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.keyCode === 229 ||
    !(event.target instanceof Element) ||
    event.target.closest(EDITING_OR_WIDGET) ||
    event.target.closest('[inert], [aria-hidden="true"]')
  )
    return true;

  // MUI drawers/popovers can be modal without assigning role="dialog" to their surface.
  return [
    ...document.querySelectorAll<HTMLElement>(
      '[aria-modal="true"], dialog[open], .MuiModal-root, [role="menu"], [role="listbox"]'
    ),
  ].some((modal) => {
    if (modal.closest('[hidden], [aria-hidden="true"]')) return false;
    const style = getComputedStyle(modal);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

/** Only modified create keys are global. C/E belong to the focused personal-detail component. */
export function useWorkHubKeyboardShortcuts(commands: WorkKeyboardCommands) {
  const current = useRef(commands);
  current.current = commands;
  const createEnabled = Boolean(commands.onCreate);

  useEffect(() => {
    if (!createEnabled) return;
    const create = (event: KeyboardEvent) => {
      if (shortcutBlocked(event)) return;
      const primary =
        event.metaKey !== event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'n';
      const alternate =
        event.altKey &&
        event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        (event.code === 'KeyN' || event.key.toLowerCase() === 'n');
      const command = current.current.onCreate;
      if ((!primary && !alternate) || !command) return;
      event.preventDefault();
      command();
    };
    window.addEventListener('keydown', create);
    return () => window.removeEventListener('keydown', create);
  }, [createEnabled]);

  return (event: ReactKeyboardEvent<HTMLElement>) => {
    const native = event.nativeEvent;
    if (
      shortcutBlocked(native) ||
      native.metaKey ||
      native.ctrlKey ||
      native.altKey ||
      native.shiftKey ||
      !event.currentTarget.contains(document.activeElement) ||
      !event.currentTarget.contains(event.target as Node)
    )
      return;
    const key = native.key.toLowerCase();
    const command =
      key === 'c' ? current.current.onComplete : key === 'e' ? current.current.onEdit : undefined;
    if (!command) return;
    event.preventDefault();
    event.stopPropagation();
    command();
  };
}
