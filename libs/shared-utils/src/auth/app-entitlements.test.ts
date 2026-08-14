import { describe, expect, it } from 'vitest';

import { isAppResourceEntitled } from './app-entitlements';

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
});
