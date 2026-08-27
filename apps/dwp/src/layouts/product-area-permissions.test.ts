import { describe, expect, it, vi } from 'vitest';

import { canAccessProductAreaNavigationItem } from './product-area-permissions';

describe('product area navigation access', () => {
  it('uses tenant authorities outside provider support mode', () => {
    const hasPermission = vi.fn((resource: string, permission?: string) =>
      resource === 'ADMIN.EXAMPLE' ? permission === 'VIEW' : false
    );
    expect(canAccessProductAreaNavigationItem({}, hasPermission)).toBe(true);
    expect(
      canAccessProductAreaNavigationItem(
        { requiredResourceKey: 'ADMIN.EXAMPLE', requiredPermissionCode: 'VIEW' },
        hasPermission
      )
    ).toBe(true);
  });

  it('applies MANAGE override and any/all authority expressions consistently', () => {
    const hasManage = vi.fn(
      (resource: string, permission?: string) =>
        resource === 'ADMIN.EXAMPLE' && permission === 'MANAGE'
    );

    expect(
      canAccessProductAreaNavigationItem(
        {
          requiredResourceKey: 'ADMIN.EXAMPLE',
          requiredAllPermissionCodes: ['VIEW', 'UPDATE'],
        },
        hasManage
      )
    ).toBe(true);
    expect(
      canAccessProductAreaNavigationItem(
        {
          requiredAnyAuthorities: [
            { resourceKey: 'ADMIN.OTHER', permissionCode: 'VIEW' },
            { resourceKey: 'ADMIN.EXAMPLE', permissionCode: 'APPROVE' },
          ],
        },
        hasManage
      )
    ).toBe(true);

    const hasAll = vi.fn(
      (resource: string, permission?: string) =>
        resource === 'ADMIN.EXAMPLE' && ['VIEW', 'UPDATE'].includes(permission ?? '')
    );
    expect(
      canAccessProductAreaNavigationItem(
        {
          requiredResourceKey: 'ADMIN.EXAMPLE',
          requiredAllPermissionCodes: ['VIEW', 'UPDATE'],
        },
        hasAll
      )
    ).toBe(true);
    expect(
      canAccessProductAreaNavigationItem(
        {
          requiredResourceKey: 'ADMIN.EXAMPLE',
          requiredAnyPermissionCodes: ['APPROVE', 'UPDATE'],
        },
        hasAll
      )
    ).toBe(true);
  });

  it('keeps all tenant product operations closed during provider support', () => {
    const hasPermission = vi.fn(() => true);
    const scopes = ['TENANT_CONFIGURATION_READ'];

    expect(canAccessProductAreaNavigationItem({}, hasPermission, scopes)).toBe(false);
    expect(
      canAccessProductAreaNavigationItem(
        {
          requiredResourceKey: 'ADMIN.EXAMPLE',
          requiredPermissionCode: 'VIEW',
          requiredAnySupportScopes: ['WORKFORCE_READ'],
        },
        hasPermission,
        scopes
      )
    ).toBe(false);
    expect(
      canAccessProductAreaNavigationItem(
        { requiredAnySupportScopes: ['TENANT_CONFIGURATION_READ'] },
        hasPermission,
        scopes
      )
    ).toBe(false);

    expect(
      canAccessProductAreaNavigationItem(
        { requiredAnySupportScopes: ['TENANT_EXPERIENCE_PREVIEW'] },
        hasPermission,
        ['TENANT_EXPERIENCE_PREVIEW']
      )
    ).toBe(false);

    expect(canAccessProductAreaNavigationItem({}, hasPermission, [])).toBe(false);
  });
});
