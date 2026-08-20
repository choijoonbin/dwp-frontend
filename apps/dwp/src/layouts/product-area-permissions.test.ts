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

  it('exposes only explicitly scoped product operations during provider support', () => {
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
    ).toBe(true);
  });
});
