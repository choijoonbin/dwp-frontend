import { isWorkplaceGovernanceUuid } from './workplace-admin-governance-model';
import type {
  WorkplaceGovernanceDelegatedPermission,
  WorkplaceGovernanceEffectiveDelegatedScope,
} from '@dwp-frontend/shared-utils';

export function workplaceDelegatedPermissionPermits(
  permissions: readonly WorkplaceGovernanceDelegatedPermission[],
  required: WorkplaceGovernanceDelegatedPermission
) {
  if (!Array.isArray(permissions)) return false;
  return (
    permissions.includes(required) ||
    (required === 'CATALOG_VIEW' &&
      permissions.some((permission) =>
        ['CATALOG_MANAGE', 'ACCESS_MANAGE', 'POLICY_MANAGE', 'FLOOR_PLAN_MANAGE'].includes(
          permission
        )
      ))
  );
}

export function workplaceDelegatedTargetAllowed(
  scopes: readonly WorkplaceGovernanceEffectiveDelegatedScope[],
  permission: WorkplaceGovernanceDelegatedPermission,
  siteId: string,
  floorId: string | null = null,
  now = Date.now()
) {
  if (
    !isWorkplaceGovernanceUuid(siteId) ||
    (floorId !== null && !isWorkplaceGovernanceUuid(floorId)) ||
    !Number.isFinite(now)
  )
    return false;
  return scopes.some((scope) => {
    if (
      scope.scopeType !== 'SITE' ||
      typeof scope.scopeId !== 'string' ||
      !isWorkplaceGovernanceUuid(scope.scopeId) ||
      scope.scopeId.toLowerCase() !== siteId.toLowerCase() ||
      !workplaceDelegatedPermissionPermits(scope.permissions, permission)
    )
      return false;
    if (
      scope.validUntil !== null &&
      (!Number.isFinite(Date.parse(scope.validUntil)) || Date.parse(scope.validUntil) <= now)
    )
      return false;
    if (scope.floorIds == null) return true;
    if (
      !Array.isArray(scope.floorIds) ||
      !scope.floorIds.length ||
      scope.floorIds.some((id) => typeof id !== 'string' || !isWorkplaceGovernanceUuid(id))
    )
      return false;
    const floors = scope.floorIds.map((id) => id.toLowerCase());
    if (new Set(floors).size !== floors.length) return false;
    return floorId !== null && floors.includes(floorId.toLowerCase());
  });
}
