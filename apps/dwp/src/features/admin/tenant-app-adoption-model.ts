import type { TenantAppAssignment, TenantAppInstallation } from '@dwp-frontend/shared-utils';

export type TenantAppInstallationAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ACTIVATE';
export type TenantAppAssignmentAction = 'APPROVE' | 'REJECT' | 'ACTIVATE' | 'REVOKE';

const INSTALLATION_ACTIONS = new Set<TenantAppInstallationAction>([
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'ACTIVATE',
]);
const ASSIGNMENT_ACTIONS = new Set<TenantAppAssignmentAction>([
  'APPROVE',
  'REJECT',
  'ACTIVATE',
  'REVOKE',
]);

export function tenantAppInstallationActions(
  installation: TenantAppInstallation,
  _actorId?: number
): TenantAppInstallationAction[] {
  return installation.allowedActions.filter((action): action is TenantAppInstallationAction =>
    INSTALLATION_ACTIONS.has(action as TenantAppInstallationAction)
  );
}

export function tenantAppAssignmentActions(
  assignment: TenantAppAssignment,
  _actorId?: number
): TenantAppAssignmentAction[] {
  return assignment.allowedActions.filter((action): action is TenantAppAssignmentAction =>
    ASSIGNMENT_ACTIONS.has(action as TenantAppAssignmentAction)
  );
}

export function tenantAppSeatState(
  installation: TenantAppInstallation
): 'AVAILABLE' | 'FULL' | 'UNBOUNDED' {
  if (installation.seatCapacity == null) return 'UNBOUNDED';
  return installation.reservedSeats >= installation.seatCapacity ? 'FULL' : 'AVAILABLE';
}
