import { describe, expect, it } from 'vitest';

import { resolveDesktopNavigationCompactPreference } from './desktop-navigation';

describe('desktop navigation preference', () => {
  it('uses each surface default until that scoped preference is explicitly changed', () => {
    expect(resolveDesktopNavigationCompactPreference(null, false)).toBe(false);
    expect(resolveDesktopNavigationCompactPreference(null, true)).toBe(true);
    expect(resolveDesktopNavigationCompactPreference('compact', false)).toBe(true);
    expect(resolveDesktopNavigationCompactPreference('expanded', true)).toBe(false);
  });

  it('ignores unknown persisted values and returns the current surface default', () => {
    expect(resolveDesktopNavigationCompactPreference('invalid', false)).toBe(false);
    expect(resolveDesktopNavigationCompactPreference('invalid', true)).toBe(true);
  });
});
