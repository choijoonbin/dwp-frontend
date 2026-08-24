import { describe, expect, it } from 'vitest';

import {
  APPROVAL_DEFAULT_PATH,
  APPROVAL_MANAGEMENT_NAVIGATION,
  APPROVAL_NAVIGATION,
  APPROVAL_WORK_NAVIGATION,
  findApprovalNavigationItem,
  isApprovalAdminView,
} from './approval-navigation';
import { canAccessProductAreaNavigationItem } from '../../layouts/product-area-permissions';

import type { ProductSurfaceNavigationGroup } from '../../components/product-manifest';

function flattenSurfaceItems(groups: readonly ProductSurfaceNavigationGroup[]) {
  return groups.flatMap((group) => group.items);
}

describe('approval product navigation', () => {
  it('keeps personal decisions and administration in explicit groups', () => {
    const decisionViews = APPROVAL_NAVIGATION.find((group) => group.id === 'decisions')?.items.map(
      (item) => item.view
    );
    const administration = APPROVAL_NAVIGATION.find(
      (group) => group.id === 'administration'
    )?.items;

    expect(APPROVAL_DEFAULT_PATH).toBe('/approvals/home');
    expect(decisionViews).toEqual([
      'inbox',
      'completed',
      'new',
      'drafts',
      'submitted',
      'needs-info',
      'archive',
      'delegations',
    ]);
    expect(administration?.every((item) => isApprovalAdminView(item.view))).toBe(true);
    expect(administration?.every((item) => item.requiredResourceKey?.startsWith('ADMIN.'))).toBe(
      true
    );
  });

  it('resolves every governed route without treating similar paths as a match', () => {
    expect(findApprovalNavigationItem('/approvals/inbox')?.view).toBe('inbox');
    expect(findApprovalNavigationItem('/approvals/completed')?.view).toBe('completed');
    expect(findApprovalNavigationItem('/approvals/admin/workflows')?.view).toBe('workflows');
    expect(findApprovalNavigationItem('/approvals/inbox/other')).toBeUndefined();
  });

  it('uses the same MANAGE override and all-permission contract as the API boundary', () => {
    const newRequest = findApprovalNavigationItem('/approvals/requests/new');
    expect(newRequest).toBeDefined();
    expect(
      canAccessProductAreaNavigationItem(
        newRequest!,
        (_resourceKey, permissionCode) => permissionCode === 'MANAGE'
      )
    ).toBe(true);
    expect(
      canAccessProductAreaNavigationItem(
        newRequest!,
        (_resourceKey, permissionCode) => permissionCode === 'CREATE'
      )
    ).toBe(false);
    expect(
      canAccessProductAreaNavigationItem(newRequest!, (_resourceKey, permissionCode) =>
        ['CREATE', 'UPDATE'].includes(permissionCode ?? '')
      )
    ).toBe(true);
  });

  it('keeps legacy MANAGE semantics out of the v2 surface authorization source', () => {
    const surfaceItems = [
      ...flattenSurfaceItems(APPROVAL_WORK_NAVIGATION),
      ...flattenSurfaceItems(APPROVAL_MANAGEMENT_NAVIGATION),
    ];
    const serializedAccess = JSON.stringify(surfaceItems.map((item) => item.access));

    expect(surfaceItems).toHaveLength(15);
    expect(serializedAccess).not.toContain('MANAGE');
    expect(serializedAccess).not.toContain('ADMIN.APPROVAL');
    expect(
      flattenSurfaceItems(APPROVAL_MANAGEMENT_NAVIGATION).every(
        (item) => item.access.type === 'capability-expression'
      )
    ).toBe(true);
  });
});
