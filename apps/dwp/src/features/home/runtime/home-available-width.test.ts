import { describe, expect, it } from 'vitest';

import {
  homeDeviceClassForAvailableWidth,
  resolveHomeAvailableWidthClass,
} from './home-available-width';

describe('Home available-width contract', () => {
  it.each([
    [320, 'mobile-compact', 'MOBILE_COMPACT'],
    [359, 'mobile-compact', 'MOBILE_COMPACT'],
    [390, 'mobile-standard', 'MOBILE_STANDARD'],
    [899, 'mobile-standard', 'MOBILE_STANDARD'],
    [984, 'desktop-standard', 'DESKTOP_STANDARD'],
    [1192, 'desktop-standard', 'DESKTOP_STANDARD'],
    [1439, 'desktop-standard', 'DESKTOP_STANDARD'],
    [1440, 'desktop-wide', 'DESKTOP_WIDE'],
    [1808, 'desktop-wide', 'DESKTOP_WIDE'],
  ] as const)('classifies %ipx as %s and %s', (width, widthClass, deviceClass) => {
    expect(resolveHomeAvailableWidthClass(width)).toBe(widthClass);
    expect(homeDeviceClassForAvailableWidth(width)).toBe(deviceClass);
  });

  it('uses measured shell space rather than the browser viewport assumption', () => {
    expect(resolveHomeAvailableWidthClass(1920 - 248 - 64)).toBe('desktop-wide');
    expect(resolveHomeAvailableWidthClass(1440 - 248)).toBe('desktop-standard');
    expect(resolveHomeAvailableWidthClass(1280 - 248)).toBe('desktop-standard');
  });

  it('fails safely for invalid measurements until the element is measured', () => {
    expect(resolveHomeAvailableWidthClass(Number.NaN)).toBe('mobile-compact');
    expect(resolveHomeAvailableWidthClass(-1)).toBe('mobile-compact');
  });
});
