import type { GroupRoleAssignment } from '@dwp-frontend/shared-utils';

export type RoleAssignmentPresentationState = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | string;

export function resolveRoleAssignmentPresentationState(
  assignment: GroupRoleAssignment,
  now = Date.now()
): RoleAssignmentPresentationState {
  if (assignment.lifecycleState !== 'ACTIVE') return assignment.lifecycleState;

  if (assignment.validTo) {
    const validTo = Date.parse(assignment.validTo);
    if (Number.isFinite(validTo) && validTo <= now) return 'EXPIRED';
  }
  if (assignment.validFrom) {
    const validFrom = Date.parse(assignment.validFrom);
    if (Number.isFinite(validFrom) && validFrom > now) return 'SCHEDULED';
  }
  return 'ACTIVE';
}

export function isRoleAssignmentValidToValid(value: string, now = Date.now()): boolean {
  if (!value) return true;
  const validTo = Date.parse(value);
  return Number.isFinite(validTo) && validTo > now;
}

export function isRoleAssignmentScopeRefValid(
  scopeType: GroupRoleAssignment['scopeType'],
  scopeRef: string
): boolean {
  if (scopeType === 'TENANT') return true;
  const normalized = scopeRef.trim();
  return normalized.length > 0 && normalized.length <= 160;
}

export function normalizedRoleAssignmentScopeRef(
  scopeType: GroupRoleAssignment['scopeType'],
  scopeRef: string
): string | undefined {
  return scopeType === 'TENANT' ? undefined : scopeRef.trim();
}
