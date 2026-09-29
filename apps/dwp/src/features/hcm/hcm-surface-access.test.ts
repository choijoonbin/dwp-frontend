import { describe, expect, it } from 'vitest';

import { canAccessLegacyHcmSurface, resolveHcmAccess } from './hcm-surface-access';

import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils/auth/app-entitlements';

function grant(
  resourceType: string,
  resourceKey: string,
  permissionCode = 'VIEW',
  effect = 'ALLOW'
): AppEntitlementPermission {
  return { resourceType, resourceKey, permissionCode, effect };
}

function project(
  permissions: readonly AppEntitlementPermission[],
  roles: readonly string[] = [],
  legacyRoleFallbackAllowed = false
) {
  const hasPermission = (resourceKey: string, permissionCode = 'VIEW') => {
    const matching = permissions.filter(
      (permission) =>
        permission.resourceKey === resourceKey && permission.permissionCode === permissionCode
    );
    if (matching.some((permission) => permission.effect === 'DENY')) return false;
    return matching.some((permission) => permission.effect === 'ALLOW');
  };
  return resolveHcmAccess({
    permissions,
    roles,
    legacyRoleFallbackAllowed,
    hasPermission,
  });
}

describe('HCM authority projection', () => {
  it('keeps the employee APP.HCM and WORKSPACE_MEMBER contract out of operations and settings', () => {
    const access = project(
      [
        grant('APP', 'APP.HCM'),
        grant('DATA', 'DATA.WORKFORCE'),
        grant('DATA', 'DATA.HR_TIME'),
        grant('DATA', 'DATA.HR_ABSENCE'),
        grant('DATA', 'DATA.HR_PAY'),
        grant('DATA', 'DATA.HR_TALENT'),
      ],
      ['WORKSPACE_MEMBER']
    );

    expect(access.canAccessPersonal).toBe(true);
    expect(access.canOperate).toBe(false);
    expect(access.canAccessOperationsOverview).toBe(false);
    expect(access.canManageWorkforce).toBe(false);
    expect(access.canAccessOrganizationDesign).toBe(false);
    expect(access.canAccessReferenceData).toBe(false);
    expect(access.canAccessDataOperations).toBe(false);
    expect(access.canAccessExports).toBe(false);
    expect(canAccessLegacyHcmSurface('hcm.operations', access)).toBe(false);
    expect(canAccessLegacyHcmSurface('hcm.management', access)).toBe(false);
  });

  it('keeps verified WORKSPACE_MEMBER fallback personal-only', () => {
    const access = project([], ['WORKSPACE_MEMBER'], true);

    expect(access.canAccessPersonal).toBe(true);
    expect(access.canAccessOperationsOverview).toBe(false);
    expect(canAccessLegacyHcmSurface('hcm.personal', access)).toBe(true);
    expect(canAccessLegacyHcmSurface('hcm.operations', access)).toBe(false);
    expect(canAccessLegacyHcmSurface('hcm.management', access)).toBe(false);
  });

  it('projects each specialist operation only from its exact DATA contract', () => {
    const access = project([
      grant('APP', 'APP.HRIS'),
      grant('DATA', 'DATA.HR_TIME', 'VIEW_TENANT'),
    ]);

    expect(access.canAccessPersonal).toBe(true);
    expect(access.canOperate).toBe(false);
    expect(access.canManageTime).toBe(true);
    expect(access.canManageAbsence).toBe(false);
    expect(access.canManagePay).toBe(false);
    expect(access.canManageTalent).toBe(false);
    expect(access.canAccessOperationsOverview).toBe(true);
  });

  it('does not let a zero-app manager or operator enter team and operations surfaces', () => {
    const access = project(
      [grant('DATA', 'DATA.WORKFORCE', 'VIEW_TENANT')],
      ['WORKSPACE_MEMBER', 'MANAGER']
    );

    expect(access.canAccessPersonal).toBe(false);
    expect(access.isManager).toBe(true);
    expect(access.canOperate).toBe(true);
    expect(canAccessLegacyHcmSurface('hcm.team', access)).toBe(false);
    expect(canAccessLegacyHcmSurface('hcm.operations', access)).toBe(false);
  });

  it('preserves A004 zero-APP administration without promoting it to employee or operator', () => {
    const access = project([grant('ACTION', 'ACTION.WORKFORCE_REFERENCE')], ['ADMIN'], true);

    expect(access.canAccessPersonal).toBe(false);
    expect(access.canOperate).toBe(false);
    expect(access.canAccessOperationsOverview).toBe(false);
    expect(access.canAccessReferenceData).toBe(true);
    expect(access.canAccessDataOperations).toBe(false);
    expect(canAccessLegacyHcmSurface('hcm.management', access)).toBe(true);
  });
});
