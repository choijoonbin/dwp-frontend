import { describe, expect, it } from 'vitest';

import { homeAccessFingerprint, homeUserAccessFingerprint } from './home-access-fingerprint';

import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils';

const viewCalendar: AppEntitlementPermission = {
  resourceType: 'APP',
  resourceKey: 'APP.CALENDAR',
  permissionCode: 'VIEW',
  effect: 'ALLOW',
};

describe('Home access fingerprint', () => {
  it('is order-insensitive and normalized', () => {
    const first = homeAccessFingerprint(
      [viewCalendar, { ...viewCalendar, resourceKey: ' app.work ' }],
      ['workspace_member', 'MANAGER']
    );
    const second = homeAccessFingerprint(
      [{ ...viewCalendar, resourceKey: 'APP.WORK' }, viewCalendar],
      ['manager', 'WORKSPACE_MEMBER']
    );

    expect(first).toBe(second);
  });

  it('changes across grant, deny, permission-code, and role boundaries', () => {
    const baseline = homeAccessFingerprint([viewCalendar], ['WORKSPACE_MEMBER']);

    expect(homeAccessFingerprint([], ['WORKSPACE_MEMBER'])).not.toBe(baseline);
    expect(
      homeAccessFingerprint([{ ...viewCalendar, effect: 'DENY' }], ['WORKSPACE_MEMBER'])
    ).not.toBe(baseline);
    expect(
      homeAccessFingerprint([{ ...viewCalendar, permissionCode: 'MANAGE' }], ['WORKSPACE_MEMBER'])
    ).not.toBe(baseline);
    expect(homeAccessFingerprint([viewCalendar], ['MANAGER'])).not.toBe(baseline);
    expect(homeAccessFingerprint([viewCalendar], ['WORKSPACE_MEMBER'], true)).not.toBe(baseline);
  });

  it('changes across verified person, group, and delegated resource-role scope', () => {
    const baseline = homeAccessFingerprint([viewCalendar], ['WORKSPACE_MEMBER'], false, {
      personPublicId: 'person-1',
      groups: [{ groupRef: 'group-finance' }],
      resourceRoles: [
        {
          responsibilityCode: 'APPROVAL_OPERATOR',
          resourceType: 'TENANT',
          resourceKey: '1',
          resourceSetId: 'set-1',
          resourceSetKey: 'tenant-1',
          validTo: '2026-12-31T00:00:00Z',
        },
      ],
    });

    expect(
      homeAccessFingerprint([viewCalendar], ['WORKSPACE_MEMBER'], false, {
        personPublicId: 'person-2',
        groups: [{ groupRef: 'group-finance' }],
      })
    ).not.toBe(baseline);
    expect(
      homeAccessFingerprint([viewCalendar], ['WORKSPACE_MEMBER'], false, {
        personPublicId: 'person-1',
        groups: [{ groupRef: 'group-finance', groupKey: 'finance-renamed' }],
        resourceRoles: [
          {
            responsibilityCode: 'APPROVAL_OPERATOR',
            resourceType: 'TENANT',
            resourceKey: '1',
            resourceSetId: 'set-1',
            resourceSetKey: 'tenant-1',
            validTo: '2026-12-31T00:00:00Z',
          },
        ],
      })
    ).not.toBe(baseline);
    expect(
      homeAccessFingerprint([viewCalendar], ['WORKSPACE_MEMBER'], false, {
        personPublicId: 'person-1',
        groups: [],
      })
    ).not.toBe(baseline);
    expect(
      homeAccessFingerprint([viewCalendar], ['WORKSPACE_MEMBER'], false, {
        personPublicId: 'person-1',
        groups: [{ groupRef: 'group-finance' }],
        resourceRoles: [],
      })
    ).not.toBe(baseline);
  });

  it('derives the complete scope from the verified session user', () => {
    const direct = homeAccessFingerprint([viewCalendar], ['WORKSPACE_MEMBER'], true, {
      personPublicId: 'person-1',
      groups: [{ groupRef: 'group-1' }],
      resourceRoles: [],
    });
    expect(
      homeUserAccessFingerprint([viewCalendar], {
        userId: 1,
        tenantId: 1,
        tenantCode: 'tenant',
        displayName: 'Member',
        identityPlane: 'TENANT',
        roles: ['WORKSPACE_MEMBER'],
        legacyRoleFallbackAllowed: true,
        personPublicId: 'person-1',
        groups: [{ groupRef: 'group-1', displayName: 'Group 1' }],
        resourceRoles: [],
      })
    ).toBe(direct);
  });
});
