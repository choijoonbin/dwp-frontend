const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type FocusBoundaryEvent = {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
};

function isTabbable(element: HTMLElement): boolean {
  if (
    element.tabIndex < 0 ||
    element.matches(':disabled') ||
    element.closest('[hidden], [aria-hidden="true"], [inert]')
  )
    return false;
  let current: HTMLElement | null = element;
  while (current) {
    const style = getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      style.opacity === '0'
    )
      return false;
    current = current.parentElement;
  }
  return true;
}

export function containMeetingOverlayTab(
  event: FocusBoundaryEvent,
  container: HTMLElement | null
): boolean {
  if (event.key !== 'Tab' || !container) return false;
  const rail = container.closest<HTMLElement>('[data-meeting-focus-overlay]');
  if (rail?.dataset.meetingFocusOverlay === 'false') return false;
  // The mobile rail is one overlay, including its roving navigation tabs.
  if (rail) container = rail;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isTabbable
  );
  if (!focusable.length) return false;
  const first = focusable[0];
  const last = focusable.at(-1)!;
  const active = container.ownerDocument.activeElement;
  const shouldWrapBackward = event.shiftKey && (active === first || !container.contains(active));
  const shouldWrapForward = !event.shiftKey && (active === last || !container.contains(active));
  if (!shouldWrapBackward && !shouldWrapForward) return false;
  event.preventDefault();
  (shouldWrapBackward ? last : first).focus();
  return true;
}
