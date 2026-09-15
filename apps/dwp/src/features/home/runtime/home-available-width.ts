import { useLayoutEffect, useRef, useState } from 'react';

import type { HomeDeviceClass } from '@dwp-frontend/shared-utils';

export const HOME_MOBILE_STANDARD_MIN_WIDTH = 360;
export const HOME_DESKTOP_STANDARD_MIN_WIDTH = 900;
export const HOME_DESKTOP_WIDE_MIN_WIDTH = 1440;

export type HomeAvailableWidthClass =
  'mobile-compact' | 'mobile-standard' | 'desktop-standard' | 'desktop-wide';

/**
 * Home breakpoints are based on the space the shell actually gives the page.
 * This remains correct when a host sidebar opens without changing the viewport.
 */
export function resolveHomeAvailableWidthClass(width: number): HomeAvailableWidthClass {
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  if (safeWidth < HOME_MOBILE_STANDARD_MIN_WIDTH) return 'mobile-compact';
  if (safeWidth < HOME_DESKTOP_STANDARD_MIN_WIDTH) return 'mobile-standard';
  if (safeWidth < HOME_DESKTOP_WIDE_MIN_WIDTH) return 'desktop-standard';
  return 'desktop-wide';
}

export function homeDeviceClassForAvailableWidth(width: number): HomeDeviceClass {
  switch (resolveHomeAvailableWidthClass(width)) {
    case 'mobile-compact':
      return 'MOBILE_COMPACT';
    case 'mobile-standard':
      return 'MOBILE_STANDARD';
    case 'desktop-standard':
      return 'DESKTOP_STANDARD';
    case 'desktop-wide':
      return 'DESKTOP_WIDE';
  }
}

function initialAvailableWidth(): number {
  return typeof window === 'undefined' ? HOME_DESKTOP_STANDARD_MIN_WIDTH : window.innerWidth;
}

export function useHomeAvailableWidth() {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState(initialAvailableWidth);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const sync = (width = element.getBoundingClientRect().width) => {
      if (width > 0) setAvailableWidth(width);
    };
    sync();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => sync(entry?.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return {
    elementRef,
    availableWidth,
    widthClass: resolveHomeAvailableWidthClass(availableWidth),
  } as const;
}
