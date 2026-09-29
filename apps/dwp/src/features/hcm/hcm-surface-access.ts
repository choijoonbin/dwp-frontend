import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import {
  hasAnyRole,
  isProviderIdentity,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { isHcmReadEntitled } from '@dwp-frontend/shared-utils/auth/hcm-access';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils/auth/app-entitlements';

const MANAGER_ROLES = ['MANAGER', 'LINE_MANAGER', 'PEOPLE_MANAGER'] as const;

export type HcmLegacySurfaceId = 'hcm.personal' | 'hcm.team' | 'hcm.operations' | 'hcm.management';

export type HcmLegacySurfaceAudience = {
  canAccessPersonal: boolean;
  isManager: boolean;
  canAccessOperationsOverview: boolean;
  canAccessOrganizationDesign: boolean;
  canAccessReferenceData: boolean;
  canAccessDataOperations: boolean;
  canAccessExports: boolean;
};

type PermissionLookup = (resourceKey: string, permissionCode?: string) => boolean;

export type HcmAccessAuthority = Readonly<{
  permissions: readonly AppEntitlementPermission[];
  roles: readonly string[];
  legacyRoleFallbackAllowed?: boolean;
  hasPermission: PermissionLookup;
  supportCanReadWorkforce?: boolean;
}>;

export type HcmAccessProjection = HcmLegacySurfaceAudience &
  Readonly<{
    canOperate: boolean;
    canManageWorkforce: boolean;
    canManageTime: boolean;
    canManageAbsence: boolean;
    canManageBenefits: boolean;
    canManagePay: boolean;
    canManageTalent: boolean;
    supportCanReadWorkforce: boolean;
  }>;

export function canAccessLegacyHcmSurface(
  surfaceId: HcmLegacySurfaceId,
  audience: HcmLegacySurfaceAudience
): boolean {
  if (surfaceId === 'hcm.personal') return audience.canAccessPersonal;
  if (surfaceId === 'hcm.team') return audience.canAccessPersonal && audience.isManager;
  if (surfaceId === 'hcm.operations') {
    return audience.canAccessPersonal && audience.canAccessOperationsOverview;
  }
  return (
    audience.canAccessOrganizationDesign ||
    audience.canAccessReferenceData ||
    audience.canAccessDataOperations ||
    audience.canAccessExports
  );
}

/**
 * Keeps SELF/app launch authority separate from operations and tenant administration authority.
 * An employee grant can open personal HR, but only exact DATA/ACTION grants can project an
 * operations or settings workbench.
 */
export function resolveHcmAccess(authority: HcmAccessAuthority): HcmAccessProjection {
  const {
    permissions,
    roles,
    hasPermission,
    legacyRoleFallbackAllowed = false,
    supportCanReadWorkforce = false,
  } = authority;
  const hasWorkforceDataAccess =
    hasPermission('DATA.WORKFORCE', 'VIEW_TENANT') || hasPermission('DATA.WORKFORCE', 'MANAGE');
  const canOperate = supportCanReadWorkforce || hasWorkforceDataAccess;
  const canManageDomain = (resource: string) =>
    hasPermission(resource, 'VIEW_TENANT') ||
    hasPermission(resource, 'APPROVE') ||
    hasPermission(resource, 'MANAGE');
  const canReadManagementResource = (resource: string) =>
    hasPermission(resource, 'VIEW') || hasPermission(resource, 'MANAGE');
  const canManageTime = canManageDomain('DATA.HR_TIME');
  const canManageAbsence = canManageDomain('DATA.HR_ABSENCE');
  const canManageBenefits = canManageDomain('DATA.HR_BENEFITS');
  const canManagePay = canManageDomain('DATA.HR_PAY');
  const canManageTalent = canManageDomain('DATA.HR_TALENT');

  return {
    canAccessPersonal: isHcmReadEntitled(permissions, roles, legacyRoleFallbackAllowed),
    canOperate,
    isManager: hasAnyRole(roles, MANAGER_ROLES),
    canManageWorkforce: hasPermission('DATA.WORKFORCE', 'MANAGE'),
    canManageTime,
    canManageAbsence,
    canManageBenefits,
    canManagePay,
    canManageTalent,
    canAccessOperationsOverview:
      canOperate ||
      canManageTime ||
      canManageAbsence ||
      canManageBenefits ||
      canManagePay ||
      canManageTalent,
    canAccessOrganizationDesign: canReadManagementResource('ACTION.WORKFORCE_ORG_DESIGN'),
    canAccessReferenceData: canReadManagementResource('ACTION.WORKFORCE_REFERENCE'),
    canAccessDataOperations: canReadManagementResource('ACTION.WORKFORCE_DATA_OPERATIONS'),
    canAccessExports: canReadManagementResource('ACTION.WORKFORCE_CONTROLLED_EXPORT'),
    supportCanReadWorkforce,
  };
}

/**
 * Resolves menu and task access from authenticated authority only.
 *
 * Keep this module free of People/Directory reads. The HCM shell imports it synchronously for
 * every HCM route, while person data belongs behind the lazy page boundary.
 */
export function useHcmAccess() {
  const auth = useAuth();
  const { permissions, hasPermission } = usePermissions();
  const roles = auth.user?.roles ?? [];
  const providerRole = isProviderIdentity(auth.user);
  const supportContext = useProviderSupportContext(providerRole);
  const supportCanReadWorkforce = supportContext.data?.scopes.includes('WORKFORCE_READ') ?? false;
  return resolveHcmAccess({
    permissions,
    roles,
    legacyRoleFallbackAllowed: auth.user?.legacyRoleFallbackAllowed === true,
    hasPermission,
    supportCanReadWorkforce,
  });
}
