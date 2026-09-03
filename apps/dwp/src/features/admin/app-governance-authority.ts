import type {
  AppAdminAssignment,
  AppAdminPresetAssignment,
  AppAdminPresetReview,
} from '@dwp-frontend/shared-utils/api/app-governance-api';
import type { ResourceRoleDTO } from '@dwp-frontend/shared-utils/api/auth-api';

export type AppGovernanceActor = {
  userId?: number;
  roles: readonly string[];
  resourceRoles: readonly ResourceRoleDTO[];
  groupRefs?: readonly string[];
};

export type AppGovernanceApprovalMode = 'STANDARD' | 'FIRST_APPROVER_BOOTSTRAP';

export function hasScopedAppResponsibility(
  resourceRoles: readonly ResourceRoleDTO[],
  responsibilityCode: string,
  resourceSetId: string
): boolean {
  return resourceRoles.some(
    (role) => role.responsibilityCode === responsibilityCode && role.resourceSetId === resourceSetId
  );
}

export function governedRequestScopes(actor: AppGovernanceActor): Set<string> | null {
  if (actor.roles.includes('APP_CATALOG_ADMIN')) return null;
  return new Set(
    actor.resourceRoles
      .filter((role) => role.responsibilityCode === 'APP_OWNER')
      .map((role) => role.resourceSetId)
  );
}

export function canRequestGovernedAssignment(actor: AppGovernanceActor): boolean {
  const scopes = governedRequestScopes(actor);
  return scopes === null || scopes.size > 0;
}

function actorIsPrincipal(
  principalType: 'USER' | 'GROUP',
  principalRef: string,
  actor: AppGovernanceActor
): boolean {
  if (principalType === 'USER') return String(actor.userId) === principalRef;
  return actor.groupRefs?.includes(principalRef) ?? false;
}

export function resolveAssignmentActions(
  assignment: AppAdminAssignment,
  actor: AppGovernanceActor
) {
  const ownerAssignment = assignment.responsibilityCode === 'APP_OWNER';
  const hasCatalogAuthority = actor.roles.includes('APP_CATALOG_ADMIN');
  const independentPendingDecision =
    assignment.lifecycleState === 'PENDING_APPROVAL' &&
    actor.userId !== undefined &&
    assignment.requestedBy !== undefined &&
    assignment.requestedBy !== null &&
    assignment.requestedBy !== actor.userId &&
    !actorIsPrincipal(assignment.principalType, assignment.principalRef, actor);
  const hasStandardApprovalAuthority = ownerAssignment
    ? hasCatalogAuthority
    : hasScopedAppResponsibility(
        actor.resourceRoles,
        'APP_ACCESS_APPROVER',
        assignment.resourceSetId
      );
  const hasFirstApproverBootstrapAuthority =
    hasCatalogAuthority &&
    assignment.firstApproverBootstrapEligible === true &&
    assignment.responsibilityCode === 'APP_ACCESS_APPROVER' &&
    assignment.assignmentSource === 'MANUAL' &&
    assignment.principalType === 'USER';
  const mayApprove =
    independentPendingDecision &&
    (hasStandardApprovalAuthority || hasFirstApproverBootstrapAuthority);
  const approvalMode: AppGovernanceApprovalMode | null = mayApprove
    ? hasFirstApproverBootstrapAuthority && !hasStandardApprovalAuthority
      ? 'FIRST_APPROVER_BOOTSTRAP'
      : 'STANDARD'
    : null;
  const mayRevoke =
    assignment.lifecycleState === 'ACTIVE' &&
    (ownerAssignment
      ? hasCatalogAuthority
      : hasScopedAppResponsibility(
          actor.resourceRoles,
          'APP_ACCESS_MANAGER',
          assignment.resourceSetId
        ));

  return { mayApprove, mayRevoke, approvalMode };
}

export function resolvePresetAssignmentActions(
  assignment: AppAdminPresetAssignment,
  actor: AppGovernanceActor
) {
  const mayApprove =
    assignment.lifecycleState === 'PENDING_APPROVAL' &&
    actor.userId !== undefined &&
    assignment.requestedBy !== undefined &&
    assignment.requestedBy !== null &&
    assignment.requestedBy !== actor.userId &&
    !actorIsPrincipal(assignment.principalType, assignment.principalRef, actor) &&
    hasScopedAppResponsibility(
      actor.resourceRoles,
      'APP_ACCESS_APPROVER',
      assignment.resourceSetId
    );
  const mayActivate =
    assignment.lifecycleState === 'APPROVED' &&
    actor.userId !== undefined &&
    assignment.requestedBy !== undefined &&
    assignment.requestedBy !== null &&
    assignment.approvedBy !== undefined &&
    assignment.approvedBy !== null &&
    assignment.requestedBy !== actor.userId &&
    assignment.approvedBy !== actor.userId &&
    !actorIsPrincipal(assignment.principalType, assignment.principalRef, actor) &&
    hasScopedAppResponsibility(actor.resourceRoles, 'APP_ACCESS_MANAGER', assignment.resourceSetId);
  const mayRevoke =
    ['APPROVED', 'ACTIVE'].includes(assignment.lifecycleState) &&
    hasScopedAppResponsibility(actor.resourceRoles, 'APP_ACCESS_MANAGER', assignment.resourceSetId);

  return { mayApprove, mayActivate, mayRevoke };
}

export function mayDecidePresetReview(
  review: AppAdminPresetReview,
  actor: AppGovernanceActor
): boolean {
  return (
    review.lifecycleState === 'OPEN' &&
    hasScopedAppResponsibility(actor.resourceRoles, 'APP_ACCESS_REVIEWER', review.resourceSetId)
  );
}
