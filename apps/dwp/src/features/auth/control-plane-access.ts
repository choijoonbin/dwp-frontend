import type { AdminNavigationItem, AdminView } from '../admin/admin-navigation';

export const FULL_TENANT_ADMIN_ROLES = ['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN'] as const;

export const TENANT_AUDIT_ROLES = ['AUDITOR', 'AUDIT_ADMIN'] as const;

export const TENANT_CONTROL_PLANE_ROLES = [
  ...FULL_TENANT_ADMIN_ROLES,
  ...TENANT_AUDIT_ROLES,
] as const;

export const WORKFORCE_OPERATIONS_ROLES = ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'] as const;

export const PROVIDER_CONTROL_PLANE_ROLES = [
  'PROVIDER_ADMIN',
  'PROVIDER_OPERATOR',
  'PROVIDER_SUPPORT',
  'PROVIDER_AUDITOR',
] as const;

const SUPPORT_CONFIGURATION_VIEWS = new Set<AdminView>([
  'branding',
  'home-experience',
  'announcements',
]);

type PermissionLookup = (resourceKey: string, permissionCode?: string) => boolean;

type AdminItemAccess = {
  roles: readonly string[];
  permissionsLoaded: boolean;
  hasPermission: PermissionLookup;
  supportScopes?: readonly string[];
};

export function hasAnyRole(roles: readonly string[], allowedRoles: readonly string[]): boolean {
  return roles.some((role) => allowedRoles.includes(role));
}

export function hasFullTenantAdminRole(roles: readonly string[]): boolean {
  return hasAnyRole(roles, FULL_TENANT_ADMIN_ROLES);
}

export function hasTenantControlPlaneRole(roles: readonly string[]): boolean {
  return hasAnyRole(roles, TENANT_CONTROL_PLANE_ROLES);
}

export function hasProviderControlPlaneRole(roles: readonly string[]): boolean {
  return hasAnyRole(roles, PROVIDER_CONTROL_PLANE_ROLES);
}

export function canEnterTenantControlPlane(
  roles: readonly string[],
  administrationAppEntitled: boolean,
  hasActiveSupportSession = false
): boolean {
  if (hasActiveSupportSession && hasProviderControlPlaneRole(roles)) return true;
  return hasTenantControlPlaneRole(roles) && administrationAppEntitled;
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

  if (item.reviewerAccessible) return !hasProviderControlPlaneRole(access.roles);
  if (!hasTenantControlPlaneRole(access.roles)) return false;
  if (!item.requiredResourceKey) return hasFullTenantAdminRole(access.roles);
  return (
    access.permissionsLoaded &&
    access.hasPermission(item.requiredResourceKey, item.requiredPermissionCode)
  );
}

export function resolvePrimaryAuthorityRole(roles: readonly string[]): string {
  const priority = [
    'PROVIDER_ADMIN',
    'PROVIDER_OPERATOR',
    'PROVIDER_SUPPORT',
    'PROVIDER_AUDITOR',
    'PLATFORM_ADMIN',
    'TENANT_ADMIN',
    'ADMIN',
    'AUDIT_ADMIN',
    'AUDITOR',
  ];
  return priority.find((role) => roles.includes(role)) ?? 'WORKSPACE_MEMBER';
}
