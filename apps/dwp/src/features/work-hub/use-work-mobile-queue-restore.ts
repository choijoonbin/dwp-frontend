import { useEffect, useRef } from 'react';

/** Keeps the exact queue row and scroll position when mobile detail returns to the list. */
export function useWorkMobileQueueRestore({
  mobile,
  requested,
}: {
  mobile: boolean;
  requested: string | null;
}) {
  const lastMobileSelection = useRef<string | null>(null);
  const queueScroll = useRef<HTMLDivElement | null>(null);
  const queueScrollTop = useRef(0);
  const restoreQueueFocus = useRef(false);

  useEffect(() => {
    if (!mobile || requested || !restoreQueueFocus.current) return;
    restoreQueueFocus.current = false;
    const frame = requestAnimationFrame(() => {
      if (queueScroll.current) queueScroll.current.scrollTop = queueScrollTop.current;
      const focusKey = lastMobileSelection.current;
      const row = [...document.querySelectorAll<HTMLElement>('[data-work-key]')].find(
        (candidate) => candidate.dataset.workKey === focusKey
      );
      (
        row?.querySelector<HTMLElement>('[data-work-open]') ??
        document.querySelector<HTMLElement>('[data-work-open]')
      )?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [mobile, requested]);

  return { lastMobileSelection, queueScroll, queueScrollTop, restoreQueueFocus };
}
