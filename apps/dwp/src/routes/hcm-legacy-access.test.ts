import { describe, expect, it, vi } from 'vitest';

import { findHcmNavigationItem } from '../features/hcm/hcm-navigation';
import { resolveProductAreaNavigationItemAccess } from '../layouts/product-area-navigation-access-decision';
import { resolveLegacyHcmShellAccess } from './hcm-routes';

function hcmItem(path: string) {
  const item = findHcmNavigationItem(path);
  if (!item) throw new Error(`Missing HCM navigation item: ${path}`);
  return item;
}

describe('HCM legacy shell and PAGE access', () => {
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
    ).toBe('allowed');
  });

  it('allows only HCM PAGE items that explicitly declare the trusted support scope', () => {
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
    ).toBe('allowed');
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
