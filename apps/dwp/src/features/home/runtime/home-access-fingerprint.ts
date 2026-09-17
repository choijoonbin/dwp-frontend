import type {
  AppEntitlementPermission,
  MeResponse,
  ResourceRoleDTO,
} from '@dwp-frontend/shared-utils';

export type HomeAccessScope = Readonly<{
  tenantId?: number | null;
  userId?: number | null;
  personPublicId?: string | null;
  groups?: readonly Readonly<{ groupRef: string; groupKey?: string | null }>[];
  resourceRoles?: readonly ResourceRoleDTO[];
}>;

function token(value: string): string {
  return value.trim().toLocaleUpperCase('en-US');
}

function opaqueDigest(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const digest = (offset: bigint) => {
    let hash = offset;
    for (const byte of bytes) {
      hash ^= BigInt(byte);
      hash = BigInt.asUintN(64, hash * 1099511628211n);
    }
    return hash.toString(16).padStart(16, '0');
  };
  return `v1:${digest(14695981039346656037n)}${digest(7809847782465536322n)}`;
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

  return opaqueDigest(
    JSON.stringify({
      permissions: [...new Set(permissionTokens)].sort(),
      roles: [...new Set(roleTokens)].sort(),
      tenantId: scope.tenantId ?? null,
      userId: scope.userId ?? null,
      personPublicId: scope.personPublicId?.trim() ?? '',
      groups: [...new Set(groupTokens)].sort(),
      resourceRoles: [...new Set(resourceRoleTokens)].sort(),
      legacyRoleFallbackAllowed,
    })
  );
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
      tenantId: user?.tenantId,
      userId: user?.userId,
      personPublicId: user?.personPublicId,
      groups: user?.groups,
      resourceRoles: user?.resourceRoles,
    }
  );
}
