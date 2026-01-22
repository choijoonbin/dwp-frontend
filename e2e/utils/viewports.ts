/**
 * Viewport configurations for E2E testing
 */

export const MOBILE_VIEWPORT = {
  width: 375,
  height: 812,
} as const;

export const TABLET_VIEWPORT = {
  width: 768,
  height: 1024,
} as const;

export const DESKTOP_VIEWPORT = {
  width: 1920,
  height: 1080,
} as const;

export const VIEWPORTS = {
  mobile: MOBILE_VIEWPORT,
  tablet: TABLET_VIEWPORT,
  desktop: DESKTOP_VIEWPORT,
} as const;
