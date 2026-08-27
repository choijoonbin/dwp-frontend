import type { ResourceRoleDTO } from '@dwp-frontend/shared-utils/api/auth-api';
import {
  canEnterTenantControlPlane,
  hasFullTenantAdminRole,
  hasProviderControlPlaneRole,
  hasTenantControlPlaneRole,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';

import type { AdminNavigationItem } from './admin-navigation';

type PermissionLookup = (resourceKey: string, permissionCode?: string) => boolean;

type AdminItemAccess = {
  roles: readonly string[];
  permissionsLoaded: boolean;
  hasPermission: PermissionLookup;
  supportScopes?: readonly string[];
  resourceRoles?: readonly ResourceRoleDTO[];
};

export function canEnterCompanyAdministration(
  roles: readonly string[],
  administrationAppEntitled: boolean,
  resourceRoles: readonly ResourceRoleDTO[] = []
): boolean {
  if (hasProviderControlPlaneRole(roles)) return false;
  return canEnterTenantControlPlane(roles, administrationAppEntitled, false, resourceRoles);
}

export function canAccessAdminNavigationItem(
  item: AdminNavigationItem,
  access: AdminItemAccess
): boolean {
  if (hasProviderControlPlaneRole(access.roles)) return false;

  if (
    item.requiredResponsibilityCodes?.some((responsibility) =>
      (access.resourceRoles ?? []).some((role) => role.responsibilityCode === responsibility)
    )
  ) {
    return true;
  }

  if (!hasTenantControlPlaneRole(access.roles)) return false;
  if (
    item.requiredAnyRoleCodes &&
    !item.requiredAnyRoleCodes.some((role) => access.roles.includes(role))
  ) {
    return false;
  }
  if (!item.requiredResourceKey) return hasFullTenantAdminRole(access.roles);
  return (
    access.permissionsLoaded &&
    access.hasPermission(item.requiredResourceKey, item.requiredPermissionCode)
  );
}
