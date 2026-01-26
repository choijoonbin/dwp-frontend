import type { RefObject } from 'react';

import { useRef, useState, useEffect, useCallback } from 'react';

export type UseScrollOffsetTopReturn<T extends HTMLElement = HTMLElement> = {
  offsetTop: boolean;
  elementRef: RefObject<T | null>;
};

/**
 * True when scroll position is past (element top or defaultValue) minus threshold.
 * Attach elementRef to an element, or use defaultValue only for window threshold.
 */
export const useScrollOffsetTop = <T extends HTMLElement = HTMLElement>(
  defaultValue: number = 0
): UseScrollOffsetTopReturn<T> => {
  const elementRef = useRef<T>(null);
  const [offsetTop, setOffsetTop] = useState(false);

  const check = useCallback(() => {
    const y = window.scrollY;
    const el = elementRef.current;
    const threshold = el ? el.offsetTop - defaultValue : defaultValue;
    setOffsetTop(y > threshold);
  }, [defaultValue]);

  useEffect(() => {
    check();
    window.addEventListener('scroll', check);
    return () => window.removeEventListener('scroll', check);
  }, [check]);

  return { elementRef, offsetTop };
};
