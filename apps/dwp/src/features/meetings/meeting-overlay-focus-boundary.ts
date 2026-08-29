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

export function containMeetingOverlayTab(
  event: FocusBoundaryEvent,
  container: HTMLElement | null
): boolean {
  if (event.key !== 'Tab' || !container) return false;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.closest('[hidden], [aria-hidden="true"], [inert]')
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
