import { useLayoutEffect, useRef } from 'react';

import type { WorkSourceReference } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

type FocusArea = 'selected' | 'candidate';

/** Keep keyboard users with the work they moved between the two plan lists. */
export function useWorkTodayPlanFocus(draft: readonly WorkSourceReference[]) {
  const controls = useRef(new Map<string, HTMLElement>());
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  const candidatesHeading = useRef<HTMLElement>(null);
  const pending = useRef<{ area: FocusArea; key: string } | null>(null);

  useLayoutEffect(() => {
    const request = pending.current;
    if (!request) return;
    pending.current = null;
    const fallback =
      request.area === 'selected' ? selectedHeading.current : candidatesHeading.current;
    (controls.current.get(`${request.area}:${request.key}`) ?? fallback)?.focus();
  }, [draft]);

  return {
    selectedHeading,
    candidatesHeading,
    moveTo: (area: FocusArea, key: string) => {
      const fallback = area === 'selected' ? selectedHeading.current : candidatesHeading.current;
      (controls.current.get(`${area}:${key}`) ?? fallback)?.focus();
    },
    register: (area: FocusArea, key: string) => (element: HTMLElement | null) => {
      const controlKey = `${area}:${key}`;
      if (element) controls.current.set(controlKey, element);
      else controls.current.delete(controlKey);
    },
    request: (area: FocusArea, key: string, clickDetail: number) => {
      // A pointer user stays at the clicked list; keyboard activation follows the work.
      pending.current = clickDetail === 0 ? { area, key } : null;
    },
  };
}
