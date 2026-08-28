import { useEffect, useRef } from 'react';

import type { RefObject } from 'react';

export function useFocusWhenReady(
  targetRef: RefObject<HTMLElement | null>,
  pending: boolean,
  ready: boolean
) {
  const focused = useRef(false);

  useEffect(() => {
    if (!pending) {
      focused.current = false;
      return;
    }
    if (!ready || focused.current) return;

    const timeout = window.setTimeout(() => {
      if (!targetRef.current) return;
      targetRef.current.focus();
      focused.current = true;
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [pending, ready, targetRef]);
}
