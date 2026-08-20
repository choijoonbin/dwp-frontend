import type { ResourceRoleDTO } from '@dwp-frontend/shared-utils/api/auth-api';
import {
  hasFullTenantAdminRole,
  hasProviderControlPlaneRole,
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

  if (item.reviewerAccessible) return !hasProviderControlPlaneRole(access.roles);
  if (!hasTenantControlPlaneRole(access.roles)) return false;
  if (!item.requiredResourceKey) return hasFullTenantAdminRole(access.roles);
  return (
    access.permissionsLoaded &&
    access.hasPermission(item.requiredResourceKey, item.requiredPermissionCode)
  );
}
