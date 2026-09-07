import { describe, expect, it } from 'vitest';

import {
  isAppReadEntitled,
  isAppResourceEntitled,
  isExplicitAppResourceEntitled,
} from './app-entitlements';

const permission = (resourceKey: string, effect = 'ALLOW') => ({
  resourceType: 'APP',
  resourceKey,
  permissionCode: 'VIEW',
  effect,
});

describe('application entitlement aliases', () => {
  it('accepts a legacy HRIS grant for the canonical HCM application', () => {
    expect(isAppResourceEntitled('APP.HCM', [permission('APP.HRIS')])).toBe(true);
  });

  it('keeps a canonical HCM grant compatible with a legacy client', () => {
    expect(isAppResourceEntitled('APP.HRIS', [permission('APP.HCM')])).toBe(true);
  });

  it('does not let either alias bypass an explicit deny', () => {
    expect(
      isAppResourceEntitled('APP.HCM', [permission('APP.HCM'), permission('APP.HRIS', 'DENY')])
    ).toBe(false);
  });

  it('requires an explicit VIEW grant for API-backed app launch surfaces', () => {
    expect(isAppReadEntitled('APP.WORK', [])).toBe(false);
    expect(
      isAppReadEntitled('APP.WORK', [{ ...permission('APP.WORK'), permissionCode: 'USE' }])
    ).toBe(false);
    expect(isAppReadEntitled('APP.WORK', [permission('APP.WORK')])).toBe(true);
  });

  it('keeps legacy empty-list compatibility out of governed Product work surfaces', () => {
    expect(isAppResourceEntitled('APP.WORK', [])).toBe(true);
    expect(isExplicitAppResourceEntitled('APP.WORK', [])).toBe(false);
    expect(isExplicitAppResourceEntitled('APP.WORK', [permission('APP.CALENDAR')])).toBe(false);
    expect(isExplicitAppResourceEntitled('APP.WORK', [permission('APP.WORK')])).toBe(true);
  });
});
