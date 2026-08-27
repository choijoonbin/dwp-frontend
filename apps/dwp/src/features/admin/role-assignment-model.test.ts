import { describe, expect, it } from 'vitest';

import { resolveRoleAssignmentActionState } from './role-assignment-columns';
import { summarizeRoleAssignments } from './role-assignment-summary';

import type { GroupRoleAssignment } from '@dwp-frontend/shared-utils';

function assignment(overrides: Partial<GroupRoleAssignment> = {}): GroupRoleAssignment {
  return {
    assignmentId: 1,
    groupId: 10,
    groupName: 'Service operators',
    roleId: 100,
    roleCode: 'SERVICE_AGENT',
    assignmentType: 'ACTIVE',
    scopeType: 'TENANT',
    lifecycleState: 'ACTIVE',
    justification: 'Required for service operations',
    version: 1,
    ...overrides,
  };
}

describe('role assignment presentation model', () => {
  it('distinguishes revocable, revoked, delegated-out, and inactive row actions', () => {
    const assignable = new Set(['SERVICE_AGENT']);

    expect(resolveRoleAssignmentActionState(assignment(), assignable)).toBe('REVOKE');
    expect(
      resolveRoleAssignmentActionState(assignment({ lifecycleState: 'REVOKED' }), assignable)
    ).toBe('REVOKED');
    expect(resolveRoleAssignmentActionState(assignment(), new Set())).toBe('MANAGED_ELSEWHERE');
    expect(
      resolveRoleAssignmentActionState(assignment({ lifecycleState: 'EXPIRED' }), assignable)
    ).toBe('NONE');
  });

  it('summarizes active records, upcoming expiry, indefinite access, and revocation history', () => {
    const now = Date.parse('2026-08-26T00:00:00Z');
    const summary = summarizeRoleAssignments(
      [
        assignment({ assignmentId: 1 }),
        assignment({ assignmentId: 2, validTo: '2026-09-10T00:00:00Z' }),
        assignment({ assignmentId: 3, validTo: '2026-10-10T00:00:00Z' }),
        assignment({ assignmentId: 4, lifecycleState: 'REVOKED' }),
      ],
      now
    );

    expect(summary).toEqual({ active: 3, expiringSoon: 1, noExpiry: 1, revoked: 1 });
  });
});
