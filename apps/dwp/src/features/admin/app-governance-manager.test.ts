import { describe, expect, it } from 'vitest';

import type { AppAdminAssignment } from '@dwp-frontend/shared-utils/api/app-governance-api';
import type { ResourceRoleDTO } from '@dwp-frontend/shared-utils/api/auth-api';

import { resolveManagementWorkbenchEntries } from './app-governance-manager';
import {
  canRequestGovernedAssignment,
  governedRequestScopes,
  resolveAssignmentActions,
  type AppGovernanceActor,
} from './app-governance-authority';

function scopedRole(responsibilityCode: string, resourceSetId = 'rs-approvals'): ResourceRoleDTO {
  return {
    responsibilityCode,
    resourceType: 'APP',
    resourceKey: 'APP.APPROVALS',
    resourceSetId,
    resourceSetKey: 'RS_APPROVALS',
  };
}

function actor(
  userId: number,
  resourceRoles: ResourceRoleDTO[] = [],
  roles: string[] = []
): AppGovernanceActor {
  return { userId, roles, resourceRoles, groupRefs: [] };
}

describe('tenant governance product workbench links', () => {
  it('resolves canonical management routes without requiring an existing product grant', () => {
    expect(
      resolveManagementWorkbenchEntries([
        {
          resourceType: 'APP',
          resourceKey: 'APP.APPROVALS',
          resourceName: 'Approvals',
        },
        {
          resourceType: 'APP',
          resourceKey: 'APP.HCM',
          resourceName: 'HCM',
        },
      ]).map(({ productId, path }) => ({ productId, path }))
    ).toEqual([
      { productId: 'approvals', path: '/approvals/admin' },
      { productId: 'hcm', path: '/hr/manage' },
    ]);
  });

  it('does not invent a workbench route for an unregistered app root', () => {
    expect(
      resolveManagementWorkbenchEntries([
        {
          resourceType: 'APP',
          resourceKey: 'APP.UNREGISTERED',
          resourceName: 'Unregistered',
        },
      ])
    ).toEqual([]);
  });
});

describe('tenant governance assignment authority', () => {
  const assignment = {
    lifecycleState: 'PENDING_APPROVAL',
    requestedBy: 10,
    principalType: 'USER',
    principalRef: '30',
    responsibilityCode: 'APP_ACCESS_REVIEWER',
    resourceSetId: 'rs-approvals',
    assignmentSource: 'MANUAL',
    firstApproverBootstrapEligible: false,
  } as AppAdminAssignment;

  it('keeps broad tenant and catalog roles out of scoped access decisions', () => {
    for (const role of ['TENANT_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'APP_CATALOG_ADMIN']) {
      expect(resolveAssignmentActions(assignment, actor(20, [], [role]))).toEqual({
        mayApprove: false,
        mayRevoke: false,
        approvalMode: null,
      });
    }
  });

  it('requires exact-scope approver and manager responsibilities', () => {
    expect(
      resolveAssignmentActions(assignment, actor(20, [scopedRole('APP_ACCESS_APPROVER')]))
    ).toMatchObject({ mayApprove: true, approvalMode: 'STANDARD' });
    expect(
      resolveAssignmentActions(
        assignment,
        actor(20, [scopedRole('APP_ACCESS_APPROVER', 'rs-other')])
      ).mayApprove
    ).toBe(false);

    const active = { ...assignment, lifecycleState: 'ACTIVE' } as AppAdminAssignment;
    expect(
      resolveAssignmentActions(active, actor(20, [scopedRole('APP_ACCESS_MANAGER')])).mayRevoke
    ).toBe(true);
  });

  it('reserves owner approval and revocation for catalog authority', () => {
    const ownerRequest = { ...assignment, responsibilityCode: 'APP_OWNER' } as AppAdminAssignment;
    expect(
      resolveAssignmentActions(ownerRequest, actor(20, [scopedRole('APP_ACCESS_APPROVER')]))
        .mayApprove
    ).toBe(false);
    expect(
      resolveAssignmentActions(ownerRequest, actor(20, [], ['APP_CATALOG_ADMIN'])).mayApprove
    ).toBe(true);

    const activeOwner = {
      ...ownerRequest,
      lifecycleState: 'ACTIVE',
    } as AppAdminAssignment;
    expect(
      resolveAssignmentActions(activeOwner, actor(20, [scopedRole('APP_ACCESS_MANAGER')])).mayRevoke
    ).toBe(false);
    expect(
      resolveAssignmentActions(activeOwner, actor(20, [], ['APP_CATALOG_ADMIN'])).mayRevoke
    ).toBe(true);
  });

  it('exposes the Auth-computed one-time first approver bootstrap to an independent catalog admin', () => {
    const firstApproverRequest = {
      ...assignment,
      responsibilityCode: 'APP_ACCESS_APPROVER',
      principalRef: '30',
      firstApproverBootstrapEligible: true,
    } as AppAdminAssignment;

    expect(
      resolveAssignmentActions(firstApproverRequest, actor(20, [], ['APP_CATALOG_ADMIN']))
    ).toEqual({
      mayApprove: true,
      mayRevoke: false,
      approvalMode: 'FIRST_APPROVER_BOOTSTRAP',
    });
  });

  it('does not widen the bootstrap hint to later, self, group, or non-catalog decisions', () => {
    const hinted = {
      ...assignment,
      responsibilityCode: 'APP_ACCESS_APPROVER',
      principalRef: '30',
      firstApproverBootstrapEligible: true,
    } as AppAdminAssignment;

    expect(resolveAssignmentActions(hinted, actor(20))).toMatchObject({ mayApprove: false });
    expect(
      resolveAssignmentActions(
        { ...hinted, firstApproverBootstrapEligible: false },
        actor(20, [], ['APP_CATALOG_ADMIN'])
      )
    ).toMatchObject({ mayApprove: false, approvalMode: null });
    expect(
      resolveAssignmentActions({ ...hinted, requestedBy: 20 }, actor(20, [], ['APP_CATALOG_ADMIN']))
    ).toMatchObject({ mayApprove: false, approvalMode: null });
    expect(
      resolveAssignmentActions(
        { ...hinted, requestedBy: null },
        actor(20, [], ['APP_CATALOG_ADMIN'])
      )
    ).toMatchObject({ mayApprove: false, approvalMode: null });
    expect(
      resolveAssignmentActions(
        { ...hinted, principalRef: '20' },
        actor(20, [], ['APP_CATALOG_ADMIN'])
      )
    ).toMatchObject({ mayApprove: false, approvalMode: null });
    expect(
      resolveAssignmentActions(
        { ...hinted, principalType: 'GROUP' },
        actor(20, [], ['APP_CATALOG_ADMIN'])
      )
    ).toMatchObject({ mayApprove: false, approvalMode: null });
  });

  it('lets catalog admins request across the catalog and owners only within owned sets', () => {
    expect(canRequestGovernedAssignment(actor(20, [], ['TENANT_ADMIN']))).toBe(false);
    expect(governedRequestScopes(actor(20, [], ['APP_CATALOG_ADMIN']))).toBeNull();

    const owner = actor(20, [scopedRole('APP_OWNER')]);
    expect(canRequestGovernedAssignment(owner)).toBe(true);
    expect([...governedRequestScopes(owner)!]).toEqual(['rs-approvals']);
  });
});
