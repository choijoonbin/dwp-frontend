import { House, Settings2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { resolveLegacyFirstAllowedNavigationPath } from './legacy-product-first-allowed-index';

const items = [
  {
    view: 'catalog',
    path: '/sample/admin/catalog',
    icon: Settings2,
    requiredResourceKey: 'ADMIN.SAMPLE_CATALOG',
    requiredPermissionCode: 'VIEW',
  },
  {
    view: 'operations',
    path: '/sample/admin/operations',
    icon: House,
    requiredResourceKey: 'ADMIN.SAMPLE_OPERATIONS',
    requiredPermissionCode: 'VIEW',
  },
] as const;

describe('legacy product first-allowed Management index', () => {
  it('selects the first locally authorized Management page', () => {
    expect(
      resolveLegacyFirstAllowedNavigationPath(
        items,
        (resourceKey) => resourceKey === 'ADMIN.SAMPLE_OPERATIONS'
      )
    ).toBe('/sample/admin/operations');
  });

  it('honors MANAGE as the legacy superset of VIEW', () => {
    expect(
      resolveLegacyFirstAllowedNavigationPath(
        items,
        (resourceKey, permissionCode) =>
          resourceKey === 'ADMIN.SAMPLE_CATALOG' && permissionCode === 'MANAGE'
      )
    ).toBe('/sample/admin/catalog');
  });

  it('does not select a page without exact authority or audience', () => {
    expect(resolveLegacyFirstAllowedNavigationPath(items, () => false)).toBeUndefined();
    expect(
      resolveLegacyFirstAllowedNavigationPath(
        items,
        () => true,
        () => false
      )
    ).toBeUndefined();
  });
});
