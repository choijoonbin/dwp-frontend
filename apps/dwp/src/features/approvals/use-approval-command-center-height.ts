import { useEffect, useState } from 'react';

import type { RefObject } from 'react';

export function useApprovalCommandCenterHeight(
  commandCenterRef: RefObject<HTMLDivElement | null>,
  mobile: boolean
) {
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    if (mobile) {
      setHeight(undefined);
      return undefined;
    }
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const top = commandCenterRef.current?.getBoundingClientRect().top;
        if (top === undefined) return;
        setHeight(Math.max(520, Math.floor(window.innerHeight - top - 24)));
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [commandCenterRef, mobile]);
  return height;
}
