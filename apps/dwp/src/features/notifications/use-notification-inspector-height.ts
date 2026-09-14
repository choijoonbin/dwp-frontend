import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export function useNotificationInspectorHeight() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number>();

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element || element.getClientRects().length === 0) return;
    const top = element.getBoundingClientRect().top + window.scrollY;
    const bottomInset = parseFloat(getComputedStyle(element).scrollMarginBottom) || 0;
    const available = Math.max(160, window.innerHeight - top - bottomInset);
    setHeight((current) => (current === available ? current : available));
  }, []);

  // Header, filters and bulk feedback can change the inspector's viewport offset.
  useLayoutEffect(measure);
  useLayoutEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return { ref, height };
}
