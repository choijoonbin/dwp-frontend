import { describe, expect, it } from 'vitest';

import { isHcmReadEntitled } from './hcm-access';

import type { AppEntitlementPermission } from './app-entitlements';

function permission(
  resourceKey: string,
  permissionCode = 'VIEW',
  effect = 'ALLOW'
): AppEntitlementPermission {
  return { resourceType: 'APP', resourceKey, permissionCode, effect };
}

describe('HCM read entitlement', () => {
  it('accepts HCM and HRIS VIEW or MANAGE and fails closed on deny', () => {
    expect(isHcmReadEntitled([permission('APP.HCM')], [])).toBe(true);
    expect(isHcmReadEntitled([permission('APP.HRIS', 'MANAGE')], [])).toBe(true);
    expect(
      isHcmReadEntitled(
        [permission('APP.HCM'), permission('APP.HRIS', 'MANAGE', 'DENY')],
        ['HR_ADMIN']
      )
    ).toBe(false);
  });

  it('uses legacy roles only with the verified legacy-model signal', () => {
    expect(isHcmReadEntitled([], ['WORKSPACE_MEMBER'])).toBe(false);
    expect(isHcmReadEntitled([], ['WORKSPACE_MEMBER'], true)).toBe(true);
    expect(isHcmReadEntitled([], ['GUEST'])).toBe(false);
    expect(
      isHcmReadEntitled(
        [
          {
            resourceType: 'DATA',
            resourceKey: 'DATA.OTHER',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ],
        ['HR_ADMIN']
      )
    ).toBe(false);
  });

  it('does not substitute adjacent People or Workforce app grants', () => {
    expect(isHcmReadEntitled([permission('APP.PEOPLE_DIRECTORY')], ['HR_ADMIN'])).toBe(false);
    expect(isHcmReadEntitled([permission('APP.WORKFORCE_MANAGEMENT')], ['ADMIN'])).toBe(false);
  });
});
