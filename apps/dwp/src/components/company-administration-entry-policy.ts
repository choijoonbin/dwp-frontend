import type { MeResponse } from '@dwp-frontend/shared-utils/api/auth-api';
import { canEnterTenantControlPlane } from '@dwp-frontend/shared-utils/auth/control-plane-access';

type PermissionLookup = (resourceKey: string, permissionCode?: string) => boolean;

type CompanyAdministrationAccess = {
  identity: Pick<MeResponse, 'identityPlane' | 'roles' | 'resourceRoles'> | null | undefined;
  permissionsLoaded: boolean;
  hasPermission: PermissionLookup;
};

/**
 * Leaf permissions exposed by the company administration application. The global account menu
 * owns only this compact entry contract; administration continues to own its navigation model.
 */
export const COMPANY_ADMINISTRATION_ENTRY_PERMISSIONS = [
  ['ADMIN.TENANT_BRANDING', 'VIEW'],
  ['ADMIN.HOME_EXPERIENCE', 'VIEW'],
  ['ADMIN.MANAGED_PREFERENCES', 'VIEW'],
  ['ADMIN.LOCALIZATION', 'VIEW'],
  ['ADMIN.IDENTITY_DIRECTORY', 'VIEW'],
  ['ADMIN.APP_GOVERNANCE', 'VIEW'],
  ['ADMIN.APP_ACCESS_REQUESTS', 'VIEW'],
  ['ADMIN.ACCESS_REVIEWS', 'VIEW'],
  ['ADMIN.ACCESS_GOVERNANCE', 'VIEW'],
  ['ADMIN.WORKFORCE_ACCESS', 'MANAGE'],
  ['ADMIN.SAVED_VIEW_CUSTODY', 'VIEW'],
  ['ADMIN.IDENTITY_PROVISIONING', 'VIEW'],
  ['ADMIN.PLATFORM_CATALOG', 'VIEW'],
  ['ADMIN.REFERENCE_DATA', 'VIEW'],
  ['ADMIN.PLATFORM_REGISTRY', 'VIEW'],
  ['ADMIN.NAVIGATION', 'VIEW'],
  ['ADMIN.PRODUCTIVITY_CONNECTOR', 'MANAGE'],
  ['ADMIN.API_MONITORING', 'VIEW'],
  ['ADMIN.AUDIT_VIEW', 'VIEW'],
  ['ADMIN.AUDIT_INVESTIGATE', 'UPDATE'],
  ['ADMIN.AUDIT_CONFIGURE', 'MANAGE'],
] as const;

export function canEnterCompanyAdministration(access: CompanyAdministrationAccess): boolean {
  const hasAuthorizedAdministrationEntry =
    access.permissionsLoaded &&
    access.hasPermission('APP.ADMINISTRATION', 'VIEW') &&
    COMPANY_ADMINISTRATION_ENTRY_PERMISSIONS.some(([resourceKey, permissionCode]) =>
      access.hasPermission(resourceKey, permissionCode)
    );

  return canEnterTenantControlPlane(access.identity, hasAuthorizedAdministrationEntry);
}
