import type { TenantAppAssignment, TenantAppInstallation } from '@dwp-frontend/shared-utils';

export type TenantAppInstallationAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ACTIVATE';
export type TenantAppAssignmentAction = 'APPROVE' | 'REJECT' | 'ACTIVATE' | 'REVOKE';

type TenantAppProductCandidate = Readonly<{ id: string; appKey: string }>;

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
  _actorId?: number,
  now = Date.now()
): TenantAppAssignmentAction[] {
  const activationUnavailable = tenantAppAssignmentActivationUnavailable(assignment, now);
  return assignment.allowedActions.filter((action): action is TenantAppAssignmentAction => {
    const known = ASSIGNMENT_ACTIONS.has(action as TenantAppAssignmentAction);
    return known && !(action === 'ACTIVATE' && activationUnavailable);
  });
}

export function tenantAppAssignmentActivationUnavailable(
  assignment: TenantAppAssignment,
  now = Date.now()
): boolean {
  if (assignment.validFrom) {
    const startsAt = Date.parse(assignment.validFrom);
    if (!Number.isFinite(startsAt) || startsAt > now) return true;
  }
  if (assignment.validTo) {
    const expiresAt = Date.parse(assignment.validTo);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return true;
  }
  return false;
}

export function tenantAppSeatState(
  installation: TenantAppInstallation
): 'AVAILABLE' | 'FULL' | 'UNBOUNDED' {
  if (installation.seatCapacity == null) return 'UNBOUNDED';
  return installation.reservedSeats >= installation.seatCapacity ? 'FULL' : 'AVAILABLE';
}

export function tenantAppInstallationCandidates<T extends TenantAppProductCandidate>({
  products,
  availableAppResourceKeys,
  requestableAppResourceKeys,
  installations,
  installationsHasMore,
}: {
  products: readonly T[];
  availableAppResourceKeys: readonly string[];
  requestableAppResourceKeys: readonly string[];
  installations: readonly Pick<TenantAppInstallation, 'productKey'>[];
  installationsHasMore: boolean;
}): T[] {
  if (installationsHasMore) return [];
  const available = new Set(availableAppResourceKeys);
  const requestable = new Set(requestableAppResourceKeys);
  const installed = new Set(installations.map((item) => item.productKey));
  return products.filter(
    (product) =>
      available.has(product.appKey) && requestable.has(product.appKey) && !installed.has(product.id)
  );
}
