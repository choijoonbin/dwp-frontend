import type { IdentityPlane, MeResponse, ResourceRoleDTO } from '../api/auth-api';

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

function isProviderControlPlaneRole(role: string): boolean {
  return role.trim().toUpperCase().startsWith('PROVIDER_');
}

type IdentityPlaneSubject = {
  identityPlane?: unknown;
  roles?: unknown;
  resourceRoles?: unknown;
};

export class IdentityPlaneContractError extends Error {
  constructor(reason: string) {
    super(`Authenticated identity plane contract is invalid: ${reason}`);
    this.name = 'IdentityPlaneContractError';
  }
}

/**
 * Resolve the durable identity plane carried by Auth `/me`.
 *
 * Roles are conflict evidence only; they are never a fallback plane signal.
 * Provider identities may be roleless, but they must not carry tenant roles or
 * tenant resource responsibilities. Tenant identities must not carry any role
 * from the reserved PROVIDER_* namespace.
 */
export function resolveIdentityPlane(identity: unknown): IdentityPlane {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    throw new IdentityPlaneContractError('identity payload is missing or malformed');
  }
  const subject = identity as IdentityPlaneSubject;
  const plane = typeof subject.identityPlane === 'string' ? subject.identityPlane : '';
  if (plane !== 'PROVIDER' && plane !== 'TENANT') {
    throw new IdentityPlaneContractError(plane ? `unknown plane ${plane}` : 'missing plane');
  }
  if (
    !Array.isArray(subject.roles) ||
    subject.roles.some((role) => typeof role !== 'string' || role.trim().length === 0)
  ) {
    throw new IdentityPlaneContractError('roles are missing or malformed');
  }

  const roles = subject.roles as string[];
  const providerRoles = roles.filter(isProviderControlPlaneRole);
  const tenantRoles = roles.filter((role) => !isProviderControlPlaneRole(role));
  if (providerRoles.length > 0 && tenantRoles.length > 0) {
    throw new IdentityPlaneContractError('provider and tenant roles are mixed');
  }
  if (plane === 'TENANT' && providerRoles.length > 0) {
    throw new IdentityPlaneContractError('tenant plane carries a provider role');
  }
  if (plane === 'PROVIDER' && tenantRoles.length > 0) {
    throw new IdentityPlaneContractError('provider plane carries a tenant role');
  }
  if (
    plane === 'PROVIDER' &&
    Array.isArray(subject.resourceRoles) &&
    subject.resourceRoles.length > 0
  ) {
    throw new IdentityPlaneContractError('provider plane carries tenant resource roles');
  }
  return plane;
}

export function isProviderIdentity(
  identity: Pick<MeResponse, 'identityPlane' | 'roles' | 'resourceRoles'> | null | undefined
): boolean {
  return identity ? resolveIdentityPlane(identity) === 'PROVIDER' : false;
}

export function isTenantIdentity(
  identity: Pick<MeResponse, 'identityPlane' | 'roles' | 'resourceRoles'> | null | undefined
): boolean {
  return identity ? resolveIdentityPlane(identity) === 'TENANT' : false;
}

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
  // Auth, Gateway and the database reserve the complete PROVIDER_* namespace.
  // Keep the client fail-closed when a new provider role is introduced before
  // its role-specific navigation label is released.
  return roles.some(isProviderControlPlaneRole);
}

export function canEnterTenantControlPlane(
  roles: readonly string[],
  administrationAppEntitled: boolean,
  _hasActiveSupportSession = false,
  resourceRoles: readonly ResourceRoleDTO[] = []
): boolean {
  if (hasProviderControlPlaneRole(roles)) return false;
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
