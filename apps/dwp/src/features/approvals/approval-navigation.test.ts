import { describe, expect, it } from 'vitest';

import {
  APPROVAL_DEFAULT_PATH,
  APPROVAL_NAVIGATION,
  findApprovalNavigationItem,
  isApprovalAdminView,
} from './approval-navigation';

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
    expect(findApprovalNavigationItem('/approvals/admin/workflows')?.view).toBe('workflows');
    expect(findApprovalNavigationItem('/approvals/inbox/other')).toBeUndefined();
  });
});
