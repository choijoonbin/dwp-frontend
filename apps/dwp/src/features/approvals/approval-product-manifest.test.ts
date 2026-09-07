import { describe, expect, it } from 'vitest';

import { APPROVAL_PRODUCT_MANIFEST } from './approval-product-manifest';
import { APPROVAL_MANAGEMENT_NAVIGATION, APPROVAL_WORK_NAVIGATION } from './approval-navigation';

import type { ProductSurfaceNavigationGroup } from '../../components/product-manifest';

function flattenSurfaceItems(groups: readonly ProductSurfaceNavigationGroup[]) {
  return groups.flatMap((group) => group.items);
}

describe('approval product surface manifest', () => {
  it('separates nine work entries from six management entries', () => {
    const [work, management] = APPROVAL_PRODUCT_MANIFEST.surfaces;

    expect(work.id).toBe('approvals.work');
    expect(work.plane).toBe('work');
    expect(work.navigation.flatMap((group) => group.items)).toHaveLength(9);
    expect(work.entryAccess).toEqual({
      type: 'policy',
      accessPolicyKey: 'approvals.work-access.v1',
      requiresProductEntitlement: true,
    });

    expect(management.id).toBe('approvals.admin');
    expect(management.plane).toBe('management');
    expect(management.navigation.flatMap((group) => group.items)).toHaveLength(6);
    expect(management.entryAccess.requiresProductEntitlement).toBe(false);
  });

  it('classifies every menu into exactly one allowed task kind', () => {
    expect(flattenSurfaceItems(APPROVAL_WORK_NAVIGATION).map((item) => item.taskKind)).toEqual(
      Array(9).fill('work')
    );
    expect(
      flattenSurfaceItems(APPROVAL_MANAGEMENT_NAVIGATION).map((item) => item.taskKind)
    ).toEqual([
      'operations',
      'administration',
      'administration',
      'administration',
      'operations',
      'administration',
    ]);
  });

  it('does not require the work app entitlement for management-only entry', () => {
    const management = APPROVAL_PRODUCT_MANIFEST.surfaces[1];
    expect(management.entryAccess.type).toBe('capability');
    if (management.entryAccess.type !== 'capability') throw new Error('capability entry expected');
    expect(management.entryAccess.entryCapabilityMode).toBe('ANY');
    expect(management.entryAccess.requiredCapabilityContractKeys).toHaveLength(10);
    expect(management.routeMatchers).toEqual([{ kind: 'prefix', path: '/approvals/admin' }]);
  });

  it('keeps unknown Work descendants in Work while the longer admin prefix wins', () => {
    const [work, management] = APPROVAL_PRODUCT_MANIFEST.surfaces;
    expect(work.routeMatchers).toContainEqual({ kind: 'prefix', path: '/approvals' });
    expect(management.routeMatchers).toContainEqual({
      kind: 'prefix',
      path: '/approvals/admin',
    });
  });
});
