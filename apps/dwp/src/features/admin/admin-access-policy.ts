import type { MeResponse } from '@dwp-frontend/shared-utils/api/auth-api';
import {
  canEnterTenantControlPlane,
  isTenantIdentity,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';

import { ADMIN_NAVIGATION, type AdminNavigationItem } from './admin-navigation';

type PermissionLookup = (resourceKey: string, permissionCode?: string) => boolean;

type AdminItemAccess = {
  identity:
    | Pick<MeResponse, 'identityPlane' | 'roles' | 'resourceRoles'>
    | null
    | undefined;
  permissionsLoaded: boolean;
  hasPermission: PermissionLookup;
  supportScopes?: readonly string[];
};

type CompanyAdministrationAccess = {
  identity:
    | Pick<MeResponse, 'identityPlane' | 'roles' | 'resourceRoles'>
    | null
    | undefined;
  permissionsLoaded: boolean;
  hasPermission: PermissionLookup;
};

export function canEnterCompanyAdministration(access: CompanyAdministrationAccess): boolean {
  const hasAuthorizedAdministrationEntry =
    access.permissionsLoaded &&
    access.hasPermission('APP.ADMINISTRATION', 'VIEW') &&
    ADMIN_NAVIGATION.some((group) =>
      group.items.some((item) =>
        canAccessAdminNavigationItem(item, {
          identity: access.identity,
          permissionsLoaded: access.permissionsLoaded,
          hasPermission: access.hasPermission,
        })
      )
    );

  return canEnterTenantControlPlane(
    access.identity,
    hasAuthorizedAdministrationEntry
  );
}

export function canAccessAdminNavigationItem(
  item: AdminNavigationItem,
  access: AdminItemAccess
): boolean {
  if (!isTenantIdentity(access.identity)) return false;

  if (
    item.requiredResponsibilityCodes?.some((responsibility) =>
      (access.identity?.resourceRoles ?? []).some(
        (role) => role.responsibilityCode === responsibility
      )
    )
  ) {
    return true;
  }

  if (!item.requiredResourceKey || !item.requiredPermissionCode) return false;
  return (
    access.permissionsLoaded &&
    access.hasPermission(item.requiredResourceKey, item.requiredPermissionCode)
  );
}
