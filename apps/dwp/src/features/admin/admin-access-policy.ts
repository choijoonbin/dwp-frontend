import type { ResourceRoleDTO } from '@dwp-frontend/shared-utils/api/auth-api';
import {
  canEnterTenantControlPlane,
  hasFullTenantAdminRole,
  hasTenantControlPlaneRole,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';

import type { AdminNavigationItem, AdminView } from './admin-navigation';

const SUPPORT_CONFIGURATION_VIEWS = new Set<AdminView>([
  'branding',
  'home-experience',
  'home-composition',
]);

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
  hasActiveSupportSession = false,
  resourceRoles: readonly ResourceRoleDTO[] = []
): boolean {
  return canEnterTenantControlPlane(
    roles,
    administrationAppEntitled,
    hasActiveSupportSession,
    resourceRoles
  );
}

export function canAccessAdminNavigationItem(
  item: AdminNavigationItem,
  access: AdminItemAccess
): boolean {
  const supportScopes = new Set(access.supportScopes ?? []);
  if (supportScopes.size > 0) {
    if (
      SUPPORT_CONFIGURATION_VIEWS.has(item.view) &&
      (supportScopes.has('TENANT_CONFIGURATION_READ') ||
        supportScopes.has('TENANT_CONFIGURATION_WRITE'))
    ) {
      return true;
    }
    return false;
  }

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
