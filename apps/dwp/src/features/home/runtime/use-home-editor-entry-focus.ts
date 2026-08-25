import { useEffect } from 'react';

export function useHomeEditorEntryFocus(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          '[data-workspace-composer-placement="floating"] button:not([disabled])'
        )
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active]);
}
