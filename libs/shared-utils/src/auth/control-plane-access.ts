import type { ResourceRoleDTO } from '../api/auth-api';

export const FULL_TENANT_ADMIN_ROLES = ['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN'] as const;

export const TENANT_AUDIT_ROLES = ['AUDITOR', 'AUDIT_ADMIN'] as const;

export const TENANT_CONTROL_PLANE_ROLES = [
  ...FULL_TENANT_ADMIN_ROLES,
  ...TENANT_AUDIT_ROLES,
  'IDENTITY_ADMIN',
  'APP_CATALOG_ADMIN',
] as const;

export const WORKFORCE_OPERATIONS_ROLES = ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'] as const;

export const COMPANY_APP_GOVERNANCE_RESPONSIBILITIES = [
  'APP_OWNER',
  'APP_ACCESS_MANAGER',
  'APP_ACCESS_APPROVER',
  'APP_ACCESS_REVIEWER',
] as const;

export const PROVIDER_CONTROL_PLANE_ROLES = [
  'PROVIDER_ADMIN',
  'PROVIDER_OPERATOR',
  'PROVIDER_SUPPORT',
  'PROVIDER_AUDITOR',
  'PROVIDER_TENANT_PROVISIONER',
  'PROVIDER_ENTITLEMENT_ADMIN',
  'PROVIDER_CHANGE_APPROVER',
  'PROVIDER_RELEASE_APPROVER',
  'PROVIDER_DATA_APPROVER',
] as const;

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
  hasActiveSupportSession = false,
  resourceRoles: readonly ResourceRoleDTO[] = []
): boolean {
  if (hasActiveSupportSession && hasProviderControlPlaneRole(roles)) return true;
  return (
    (hasTenantControlPlaneRole(roles) && administrationAppEntitled) ||
    resourceRoles.some((role) =>
      COMPANY_APP_GOVERNANCE_RESPONSIBILITIES.includes(
        role.responsibilityCode as (typeof COMPANY_APP_GOVERNANCE_RESPONSIBILITIES)[number]
      )
    )
  );
}

export function resolvePrimaryAuthorityRole(
  roles: readonly string[],
  resourceRoles: readonly ResourceRoleDTO[] = []
): string {
  const priority = [
    'PROVIDER_ADMIN',
    'PROVIDER_OPERATOR',
    'PROVIDER_SUPPORT',
    'PROVIDER_AUDITOR',
    'PROVIDER_TENANT_PROVISIONER',
    'PROVIDER_ENTITLEMENT_ADMIN',
    'PROVIDER_CHANGE_APPROVER',
    'PROVIDER_RELEASE_APPROVER',
    'PROVIDER_DATA_APPROVER',
    'PLATFORM_ADMIN',
    'TENANT_ADMIN',
    'ADMIN',
    'AUDIT_ADMIN',
    'AUDITOR',
    'IDENTITY_ADMIN',
    'APP_CATALOG_ADMIN',
    'COMMUNICATIONS_PUBLISHER',
    'COMMUNICATIONS_EDITOR',
    'SERVICE_CATALOG_MANAGER',
    'SERVICE_AGENT',
    'SPACE_GOVERNANCE_ADMIN',
    'SPACE_TEMPLATE_ADMIN',
    'SPACE_COMPLIANCE_REVIEWER',
    'SPACE_ACCESS_REVIEWER',
  ];
  const tenantRole = priority.find((role) => roles.includes(role));
  if (tenantRole) return tenantRole;
  const scopedPriority = [
    'APP_OWNER',
    'APP_ACCESS_MANAGER',
    'APP_ACCESS_APPROVER',
    'APP_ACCESS_REVIEWER',
    'APP_CONFIG_ADMIN',
  ];
  return (
    scopedPriority.find((responsibility) =>
      resourceRoles.some((role) => role.responsibilityCode === responsibility)
    ) ?? 'WORKSPACE_MEMBER'
  );
}
