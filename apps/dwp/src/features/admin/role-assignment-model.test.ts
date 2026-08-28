import { describe, expect, it } from 'vitest';

import { resolveRoleAssignmentActionState } from './role-assignment-columns';
import {
  isRoleAssignmentScopeRefValid,
  isRoleAssignmentValidToValid,
  normalizedRoleAssignmentScopeRef,
  resolveRoleAssignmentPresentationState,
} from './role-assignment-model';
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
    ).toBe('EXPIRED');
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

  it('presents persisted active rows by their effective validity window', () => {
    const now = Date.parse('2026-08-26T00:00:00Z');
    const expired = assignment({ validTo: '2026-08-25T23:59:59Z' });
    const scheduled = assignment({ validFrom: '2026-08-27T00:00:00Z' });

    expect(resolveRoleAssignmentPresentationState(expired, now)).toBe('EXPIRED');
    expect(resolveRoleAssignmentPresentationState(scheduled, now)).toBe('SCHEDULED');
    expect(resolveRoleAssignmentActionState(expired, new Set(['SERVICE_AGENT']), now)).toBe(
      'EXPIRED'
    );
    expect(resolveRoleAssignmentActionState(scheduled, new Set(['SERVICE_AGENT']), now)).toBe(
      'REVOKE'
    );
    expect(summarizeRoleAssignments([expired, scheduled], now)).toEqual({
      active: 0,
      expiringSoon: 0,
      noExpiry: 0,
      revoked: 0,
    });
  });

  it('rejects past validity ends and invalid scoped references before submission', () => {
    const now = Date.parse('2026-08-26T00:00:00Z');

    expect(isRoleAssignmentValidToValid('', now)).toBe(true);
    expect(isRoleAssignmentValidToValid('2026-08-25T23:59:59Z', now)).toBe(false);
    expect(isRoleAssignmentValidToValid('2026-08-26T00:00:01Z', now)).toBe(true);
    expect(isRoleAssignmentValidToValid('not-a-date', now)).toBe(false);
    expect(isRoleAssignmentScopeRefValid('TENANT', '')).toBe(true);
    expect(isRoleAssignmentScopeRefValid('ORG_UNIT', 'org-42')).toBe(true);
    expect(isRoleAssignmentScopeRefValid('RESOURCE', ' '.repeat(2))).toBe(false);
    expect(isRoleAssignmentScopeRefValid('RESOURCE', 'r'.repeat(161))).toBe(false);
    expect(normalizedRoleAssignmentScopeRef('TENANT', 'stale-hidden-value')).toBeUndefined();
    expect(normalizedRoleAssignmentScopeRef('ORG_UNIT', ' org-42 ')).toBe('org-42');
  });
});
