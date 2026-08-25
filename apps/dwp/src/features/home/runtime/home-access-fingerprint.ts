import type {
  AppEntitlementPermission,
  MeResponse,
  ResourceRoleDTO,
} from '@dwp-frontend/shared-utils';

export type HomeAccessScope = Readonly<{
  personPublicId?: string | null;
  groups?: readonly Readonly<{ groupRef: string; groupKey?: string | null }>[];
  resourceRoles?: readonly ResourceRoleDTO[];
}>;

function token(value: string): string {
  return value.trim().toLocaleUpperCase('en-US');
}

/**
 * Keeps query caches on the same boundary as the verified session scope.
 * A permission grant, deny, or role change must never reuse data fetched
 * under the previous authority set.
 */
export function homeAccessFingerprint(
  permissions: readonly AppEntitlementPermission[],
  roles: readonly string[],
  legacyRoleFallbackAllowed = false,
  scope: HomeAccessScope = {}
): string {
  const permissionTokens = permissions
    .map((permission) =>
      [
        token(permission.resourceType),
        token(permission.resourceKey),
        token(permission.permissionCode),
        token(permission.effect),
      ].join(':')
    )
    .filter(Boolean);
  const roleTokens = roles.map(token).filter(Boolean);
  const groupTokens = (scope.groups ?? [])
    .map((group) => [token(group.groupRef), token(group.groupKey ?? '')].join(':'))
    .filter(Boolean);
  const resourceRoleTokens = (scope.resourceRoles ?? []).map((role) =>
    [
      token(role.responsibilityCode),
      token(role.resourceType),
      token(role.resourceKey),
      token(role.resourceSetId),
      token(role.resourceSetKey),
      role.validTo?.trim() ?? '',
    ].join(':')
  );

  return JSON.stringify({
    permissions: [...new Set(permissionTokens)].sort(),
    roles: [...new Set(roleTokens)].sort(),
    personPublicId: scope.personPublicId?.trim() ?? '',
    groups: [...new Set(groupTokens)].sort(),
    resourceRoles: [...new Set(resourceRoleTokens)].sort(),
    legacyRoleFallbackAllowed,
  });
}

export function homeUserAccessFingerprint(
  permissions: readonly AppEntitlementPermission[],
  user: MeResponse | null | undefined
): string {
  return homeAccessFingerprint(
    permissions,
    user?.roles ?? [],
    user?.legacyRoleFallbackAllowed === true,
    {
      personPublicId: user?.personPublicId,
      groups: user?.groups,
      resourceRoles: user?.resourceRoles,
    }
  );
}
