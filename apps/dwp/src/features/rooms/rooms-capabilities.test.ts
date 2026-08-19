import { describe, expect, it } from 'vitest';

import {
  resolveRoomsCapabilities,
  resolveWorkplaceGovernanceCapabilities,
} from './rooms-capabilities';

describe('rooms capabilities', () => {
  it('keeps view, booking, catalog, and policy capabilities independent', () => {
    const grants = new Set([
      'APP.WORKPLACE:VIEW',
      'APP.WORKPLACE:CREATE',
      'ADMIN.WORKPLACE:VIEW',
      'ADMIN.WORKPLACE:UPDATE',
      'APP.ROOMS:VIEW',
      'ADMIN.ROOMS:MANAGE',
    ]);
    const capabilities = resolveRoomsCapabilities((resource, permission) =>
      grants.has(`${resource}:${permission}`)
    );

    expect(capabilities).toMatchObject({
      canViewWorkplace: true,
      canCreateWorkplaceBooking: true,
      canUpdateWorkplaceBooking: false,
      canCreateWorkplaceAdmin: false,
      canUpdateWorkplaceAdmin: true,
      canManageWorkplaceAdmin: false,
      canViewRooms: true,
      canCreateRoomBooking: false,
      canManageRoomsAdmin: true,
    });
  });

  it('defaults every capability to denied when the session has no grant', () => {
    expect(Object.values(resolveRoomsCapabilities(() => false))).not.toContain(true);
  });

  it('maps delegated governance permissions to only their least-privilege surfaces', () => {
    const capabilities = resolveWorkplaceGovernanceCapabilities({
      globalAdministrator: false,
      canViewWorkplaceAdmin: true,
      canManageWorkplaceAdmin: false,
      effectiveScopes: [
        {
          delegationId: 'delegation-1',
          scopeType: 'SITE',
          scopeId: 'site-1',
          permissions: ['CATALOG_MANAGE', 'FLOOR_PLAN_MANAGE'],
          validUntil: null,
        },
      ],
    });

    expect(capabilities.hierarchy).toMatchObject({ canView: true, canManage: true });
    expect(capabilities.floorPlans).toMatchObject({ canView: true, canManage: true });
    expect(capabilities.access.canView).toBe(false);
    expect(capabilities.policy.canView).toBe(false);
    expect(capabilities.delegation.canManage).toBe(false);
  });

  it('keeps assignment management global even when delegation status is visible', () => {
    const capabilities = resolveWorkplaceGovernanceCapabilities({
      globalAdministrator: false,
      canViewWorkplaceAdmin: true,
      canManageWorkplaceAdmin: false,
      effectiveScopes: [
        {
          delegationId: 'delegation-2',
          scopeType: 'GROUP_REF',
          scopeId: 'group-1',
          permissions: ['DELEGATION_VIEW'],
          validUntil: null,
        },
      ],
    });

    expect(capabilities.delegation).toEqual({
      canView: true,
      canManage: false,
      canViewAssignments: false,
    });
  });
});
