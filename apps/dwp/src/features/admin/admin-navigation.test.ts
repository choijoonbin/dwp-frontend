import { describe, expect, it, vi } from 'vitest';

import { canAccessAdminNavigationItem } from './admin-access-policy';
import { ADMIN_NAVIGATION, findAdminNavigationItem } from './admin-navigation';

const EXACT_PERMISSION_LEAVES = {
  branding: 'ADMIN.TENANT_BRANDING',
  'preference-exceptions': 'ADMIN.MANAGED_PREFERENCES',
  localization: 'ADMIN.LOCALIZATION',
  'access-reviews': 'ADMIN.ACCESS_REVIEWS',
  roles: 'ADMIN.ACCESS_GOVERNANCE',
  catalog: 'ADMIN.PLATFORM_CATALOG',
  'reference-data': 'ADMIN.REFERENCE_DATA',
  registry: 'ADMIN.PLATFORM_REGISTRY',
  navigation: 'ADMIN.NAVIGATION',
} as const;

function navigationItem(view: keyof typeof EXACT_PERMISSION_LEAVES) {
  const match = ADMIN_NAVIGATION.flatMap(({ items }) => items).find(
    (candidate) => candidate.view === view
  );
  if (!match) throw new Error(`Missing admin navigation item: ${view}`);
  return match;
}

const tenantIdentity = (roles: string[]) => ({
  identityPlane: 'TENANT' as const,
  roles,
  resourceRoles: [],
});

describe('admin navigation route resolution', () => {
  it('does not duplicate product-owned operations in the control center', () => {
    expect(findAdminNavigationItem('spaces', 'overview')).toBeUndefined();
    expect(findAdminNavigationItem('services', 'service-catalog')).toBeUndefined();
    expect(findAdminNavigationItem('notifications', 'overview')).toBeUndefined();
  });

  it('keeps existing routes with matching view identifiers stable', () => {
    expect(findAdminNavigationItem('identity', 'access')?.view).toBe('access');
    expect(findAdminNavigationItem('governance', 'audit')?.view).toBe('audit');
  });

  it('rejects unknown route combinations', () => {
    expect(findAdminNavigationItem('platform', 'unknown')).toBeUndefined();
  });

  it('binds each formerly role-only administration leaf to its canonical read permission', () => {
    for (const [view, resourceKey] of Object.entries(EXACT_PERMISSION_LEAVES)) {
      expect(navigationItem(view as keyof typeof EXACT_PERMISSION_LEAVES)).toMatchObject({
        requiredResourceKey: resourceKey,
        requiredPermissionCode: 'VIEW',
      });
    }
  });

  it('keeps every visible administration leaf behind an explicit resource and action', () => {
    for (const candidate of ADMIN_NAVIGATION.flatMap(({ items }) => items)) {
      expect(candidate.requiredResourceKey, candidate.view).toMatch(/^ADMIN\./u);
      expect(candidate.requiredPermissionCode, candidate.view).toMatch(
        /^(VIEW|CREATE|UPDATE|APPROVE|MANAGE|EXECUTE|EXPORT)$/u
      );
    }
  });

  it('does not expose an exact-permission leaf to a broad tenant role alone', () => {
    for (const view of Object.keys(EXACT_PERMISSION_LEAVES) as Array<
      keyof typeof EXACT_PERMISSION_LEAVES
    >) {
      const hasPermission = vi.fn(() => false);

      expect(
        canAccessAdminNavigationItem(navigationItem(view), {
          identity: tenantIdentity(['TENANT_ADMIN']),
          permissionsLoaded: true,
          hasPermission,
        })
      ).toBe(false);
      expect(hasPermission).toHaveBeenCalledWith(EXACT_PERMISSION_LEAVES[view], 'VIEW');
    }
  });

  it('exposes each read page only after its exact VIEW permission is loaded', () => {
    for (const view of Object.keys(EXACT_PERMISSION_LEAVES) as Array<
      keyof typeof EXACT_PERMISSION_LEAVES
    >) {
      const resourceKey = EXACT_PERMISSION_LEAVES[view];
      const hasPermission = vi.fn(
        (candidateResource: string, action?: string) =>
          candidateResource === resourceKey && action === 'VIEW'
      );

      expect(
        canAccessAdminNavigationItem(navigationItem(view), {
          identity: tenantIdentity(['CUSTOM_GROUP_ADMIN']),
          permissionsLoaded: false,
          hasPermission,
        })
      ).toBe(false);
      expect(
        canAccessAdminNavigationItem(navigationItem(view), {
          identity: tenantIdentity(['CUSTOM_GROUP_ADMIN']),
          permissionsLoaded: true,
          hasPermission,
        })
      ).toBe(true);
    }
  });
});
