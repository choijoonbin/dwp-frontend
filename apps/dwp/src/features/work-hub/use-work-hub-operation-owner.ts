import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

/** Work's transient snapshots and commands belong to the current security scope, not a URL. */
export function useWorkHubOperationOwner() {
  const { user, isAuthenticated } = useAuth();
  const { permissions } = usePermissions();
  if (!isAuthenticated || !user) return null;
  return JSON.stringify({
    identity: [user.identityPlane, user.tenantId, user.userId, user.personPublicId ?? ''],
    roles: [...(user.roles ?? [])].sort(),
    groups: (user.groups ?? []).map((group) => JSON.stringify(group)).sort(),
    resourceRoles: (user.resourceRoles ?? []).map((role) => JSON.stringify(role)).sort(),
    legacyRoleFallbackAllowed: user.legacyRoleFallbackAllowed === true,
    permissions: permissions.map((permission) => JSON.stringify(permission)).sort(),
  });
}
