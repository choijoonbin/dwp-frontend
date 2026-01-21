// ----------------------------------------------------------------------

/**
 * Standard UI Action Types
 * 
 * These values must match the backend CodeGroup (UI_ACTION or EVENT_TYPE).
 * Frontend should NOT create arbitrary action strings.
 * 
 * Standard actions for event tracking:
 * - VIEW: Page/view opened
 * - CLICK: Button/link clicked
 * - EXECUTE: Action executed (e.g., AI execution, mail send)
 * - SCROLL: Page scrolled
 * - SEARCH: Search performed
 * - FILTER: Filter applied
 * - DOWNLOAD: File downloaded
 * - OPEN: Dialog/modal opened
 * - CLOSE: Dialog/modal closed
 * - SUBMIT: Form submitted
 */
export type UiAction = 
  | 'VIEW'
  | 'CLICK'
  | 'EXECUTE'
  | 'SCROLL'
  | 'SEARCH'
  | 'FILTER'
  | 'DOWNLOAD'
  | 'OPEN'
  | 'CLOSE'
  | 'SUBMIT';

/**
 * Check if a string is a valid UiAction
 */
export const isValidUiAction = (action: string): action is UiAction => {
  const validActions: UiAction[] = [
    'VIEW',
    'CLICK',
    'EXECUTE',
    'SCROLL',
    'SEARCH',
    'FILTER',
    'DOWNLOAD',
    'OPEN',
    'CLOSE',
    'SUBMIT',
  ];
  return validActions.includes(action as UiAction);
};

/**
 * Normalize action string to UiAction (uppercase)
 * Returns the normalized action or null if invalid
 */
export const normalizeAction = (action: string): UiAction | null => {
  const upper = action.toUpperCase();
  return isValidUiAction(upper) ? upper : null;
};
