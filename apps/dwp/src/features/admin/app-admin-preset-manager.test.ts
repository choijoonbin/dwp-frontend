import { describe, expect, it } from 'vitest';

import type {
  AppAdminPresetAssignment,
  AppAdminPresetReview,
} from '@dwp-frontend/shared-utils/api/app-governance-api';
import type { ResourceRoleDTO } from '@dwp-frontend/shared-utils/api/auth-api';

import {
  mayDecidePresetReview,
  resolvePresetAssignmentActions,
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
  resourceRoles: ResourceRoleDTO[],
  roles: string[] = []
): AppGovernanceActor {
  return { userId, roles, resourceRoles, groupRefs: [] };
}

function assignment(
  lifecycleState: AppAdminPresetAssignment['lifecycleState']
): AppAdminPresetAssignment {
  return {
    lifecycleState,
    requestedBy: 10,
    approvedBy: lifecycleState === 'APPROVED' ? 20 : null,
    principalType: 'USER',
    principalRef: '30',
    resourceSetId: 'rs-approvals',
  } as AppAdminPresetAssignment;
}

describe('app administrator preset actions', () => {
  it('separates requester, approver, activator, and target user', () => {
    const pending = assignment('PENDING_APPROVAL');
    const approver = scopedRole('APP_ACCESS_APPROVER');
    expect(resolvePresetAssignmentActions(pending, actor(10, [approver])).mayApprove).toBe(false);
    expect(resolvePresetAssignmentActions(pending, actor(30, [approver])).mayApprove).toBe(false);
    expect(resolvePresetAssignmentActions(pending, actor(20, [approver])).mayApprove).toBe(true);

    const approved = assignment('APPROVED');
    const manager = scopedRole('APP_ACCESS_MANAGER');
    expect(resolvePresetAssignmentActions(approved, actor(10, [manager])).mayActivate).toBe(false);
    expect(resolvePresetAssignmentActions(approved, actor(20, [manager])).mayActivate).toBe(false);
    expect(resolvePresetAssignmentActions(approved, actor(30, [manager])).mayActivate).toBe(false);
    expect(resolvePresetAssignmentActions(approved, actor(40, [manager])).mayActivate).toBe(true);
  });

  it('allows only an exact-scope access manager to cancel approved or active packages', () => {
    const manager = actor(40, [scopedRole('APP_ACCESS_MANAGER')]);
    expect(resolvePresetAssignmentActions(assignment('APPROVED'), manager).mayRevoke).toBe(true);
    expect(resolvePresetAssignmentActions(assignment('ACTIVE'), manager).mayRevoke).toBe(true);
    expect(resolvePresetAssignmentActions(assignment('PENDING_APPROVAL'), manager).mayRevoke).toBe(
      false
    );
    expect(
      resolvePresetAssignmentActions(
        assignment('APPROVED'),
        actor(40, [scopedRole('APP_ACCESS_MANAGER', 'rs-other')])
      )
    ).toEqual({
      mayApprove: false,
      mayActivate: false,
      mayRevoke: false,
    });
  });

  it('does not convert tenant or catalog governance roles into scoped action authority', () => {
    for (const role of ['TENANT_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'APP_CATALOG_ADMIN']) {
      expect(
        resolvePresetAssignmentActions(assignment('PENDING_APPROVAL'), actor(40, [], [role]))
      ).toEqual({
        mayApprove: false,
        mayActivate: false,
        mayRevoke: false,
      });
    }
  });

  it('requires the reviewer responsibility on the review resource set', () => {
    const review = {
      lifecycleState: 'OPEN',
      resourceSetId: 'rs-approvals',
    } as AppAdminPresetReview;
    expect(mayDecidePresetReview(review, actor(40, [scopedRole('APP_ACCESS_REVIEWER')]))).toBe(
      true
    );
    expect(
      mayDecidePresetReview(review, actor(40, [scopedRole('APP_ACCESS_REVIEWER', 'rs-other')]))
    ).toBe(false);
    expect(mayDecidePresetReview(review, actor(40, [], ['TENANT_ADMIN']))).toBe(false);
  });
});
