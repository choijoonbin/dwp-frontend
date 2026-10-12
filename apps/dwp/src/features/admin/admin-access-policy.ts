import type { MeResponse } from '@dwp-frontend/shared-utils/api/auth-api';
import { isTenantIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';

import type { AdminNavigationItem } from './admin-navigation';
export { canEnterCompanyAdministration } from '../../components/company-administration-entry-policy';

type PermissionLookup = (resourceKey: string, permissionCode?: string) => boolean;

type AdminItemAccess = {
  identity: Pick<MeResponse, 'identityPlane' | 'roles' | 'resourceRoles'> | null | undefined;
  permissionsLoaded: boolean;
  hasPermission: PermissionLookup;
  supportScopes?: readonly string[];
};

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
