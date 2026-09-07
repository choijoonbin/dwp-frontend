import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { findHcmNavigationItem } from '../features/hcm/hcm-navigation';
import { resolveProductAreaNavigationItemAccess } from '../layouts/product-area-navigation-access-decision';
import { resolveLegacyHcmShellAccess, resolveLegacyHcmSurfaceAccess } from './hcm-routes';

function hcmItem(path: string) {
  const item = findHcmNavigationItem(path);
  if (!item) throw new Error(`Missing HCM navigation item: ${path}`);
  return item;
}

describe('HCM legacy shell and PAGE access', () => {
  it('keeps the initial HCM shell authority resolver off the shared-utils root barrel', () => {
    const source = readFileSync(
      new URL('../features/hcm/hcm-surface-access.ts', import.meta.url),
      'utf8'
    );
    const routes = readFileSync(new URL('./hcm-routes.tsx', import.meta.url), 'utf8');

    expect(source).not.toMatch(/from ['"]@dwp-frontend\/shared-utils['"]/);
    expect(source).not.toContain('/api/people-admin-api');
    expect(source).toContain("from '@dwp-frontend/shared-utils/auth/hcm-access'");
    expect(routes).toContain("from '../features/hcm/hcm-surface-access'");
    expect(routes).not.toContain("from '../features/hcm/use-hcm-experience'");
  });

  it('never falls from provider support into normal entitlement authorization', () => {
    expect(
      resolveLegacyHcmShellAccess({
        providerRole: true,
        supportContextLoading: false,
        supportScopes: ['TENANT_CONFIGURATION_READ'],
        entitled: true,
      })
    ).toBe('denied');
    expect(
      resolveLegacyHcmShellAccess({
        providerRole: true,
        supportContextLoading: false,
        supportScopes: undefined,
        entitled: true,
      })
    ).toBe('denied');
    expect(
      resolveLegacyHcmShellAccess({
        providerRole: true,
        supportContextLoading: false,
        supportScopes: ['WORKFORCE_READ'],
        entitled: false,
      })
    ).toBe('denied');
  });

  it('waits for legacy permissions instead of redirecting early', () => {
    expect(
      resolveLegacyHcmShellAccess({
        providerRole: false,
        permissionsLoaded: false,
        supportContextLoading: false,
        entitled: false,
      })
    ).toBe('loading');
    expect(
      resolveLegacyHcmShellAccess({
        providerRole: false,
        permissionsLoaded: false,
        supportContextLoading: false,
        governed: true,
        entitled: false,
      })
    ).toBe('allowed');
  });

  it('separates HCM personal, team, operations, and foundation audiences', () => {
    const denied = {
      canAccessPersonal: false,
      isManager: false,
      canAccessOperationsOverview: false,
      canAccessOrganizationDesign: false,
      canAccessReferenceData: false,
      canAccessDataOperations: false,
      canAccessExports: false,
    };

    expect(
      resolveLegacyHcmSurfaceAccess('hcm.personal', { ...denied, canAccessPersonal: true })
    ).toBe(true);
    expect(resolveLegacyHcmSurfaceAccess('hcm.team', { ...denied, isManager: true })).toBe(true);
    expect(
      resolveLegacyHcmSurfaceAccess('hcm.operations', {
        ...denied,
        canAccessOperationsOverview: true,
      })
    ).toBe(true);
    expect(
      resolveLegacyHcmSurfaceAccess('hcm.management', {
        ...denied,
        canAccessReferenceData: true,
      })
    ).toBe(true);
    expect(resolveLegacyHcmSurfaceAccess('hcm.management', denied)).toBe(false);
  });

  it('rejects retired workforce scopes for every HCM PAGE item', () => {
    const runtime = {
      permissionsLoaded: true,
      providerRole: true,
      supportContextLoading: false,
      supportScopes: ['WORKFORCE_READ'],
      hasPermission: vi.fn(() => true),
    } as const;

    expect(
      resolveProductAreaNavigationItemAccess(
        hcmItem('/hr/directory'),
        runtime.hasPermission,
        runtime.permissionsLoaded,
        runtime.providerRole,
        runtime.supportContextLoading,
        runtime.supportScopes
      )
    ).toBe('support-scope-denied');
    expect(
      resolveProductAreaNavigationItemAccess(
        hcmItem('/hr/pay'),
        runtime.hasPermission,
        runtime.permissionsLoaded,
        runtime.providerRole,
        runtime.supportContextLoading,
        runtime.supportScopes
      )
    ).toBe('support-scope-denied');
    expect(
      resolveProductAreaNavigationItemAccess(
        hcmItem('/hr/services'),
        runtime.hasPermission,
        runtime.permissionsLoaded,
        runtime.providerRole,
        runtime.supportContextLoading,
        runtime.supportScopes
      )
    ).toBe('support-scope-denied');
  });

  it('uses the common MANAGE override and authority expressions for HCM pages', () => {
    const operation = hcmItem('/hr/operations/time');
    const tenantRuntime = {
      permissionsLoaded: true,
      providerRole: false,
      supportContextLoading: false,
    } as const;

    expect(
      resolveProductAreaNavigationItemAccess(
        operation,
        (_resourceKey: string, permissionCode?: string) => permissionCode === 'MANAGE',
        tenantRuntime.permissionsLoaded,
        tenantRuntime.providerRole,
        tenantRuntime.supportContextLoading
      )
    ).toBe('allowed');
    expect(
      resolveProductAreaNavigationItemAccess(
        {
          ...operation,
          requiredResourceKey: undefined,
          requiredAnyPermissionCodes: undefined,
          requiredAnyAuthorities: [
            { resourceKey: 'DATA.HR_TIME', permissionCode: 'VIEW' },
            { resourceKey: 'DATA.HR_ABSENCE', permissionCode: 'APPROVE' },
          ],
        },
        (resourceKey: string, permissionCode?: string) =>
          resourceKey === 'DATA.HR_ABSENCE' && permissionCode === 'MANAGE',
        tenantRuntime.permissionsLoaded,
        tenantRuntime.providerRole,
        tenantRuntime.supportContextLoading
      )
    ).toBe('allowed');
    expect(
      resolveProductAreaNavigationItemAccess(
        operation,
        () => false,
        tenantRuntime.permissionsLoaded,
        tenantRuntime.providerRole,
        tenantRuntime.supportContextLoading
      )
    ).toBe('route-denied');
  });
});
