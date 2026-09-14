import { describe, expect, it } from 'vitest';

import {
  approvalManagementScopeIdentity,
  approvalManagementScopeIsReady,
} from './approval-management-scope';

describe('approval management scope identity', () => {
  it('changes for every authority component that fences local admin state', () => {
    const base = ['tenant-a', 'user-a', 'NORMAL', 'approvals.admin', 'scope-a', 'revision-a'];
    const identity = approvalManagementScopeIdentity(base);

    base.forEach((value, index) => {
      const changed = [...base];
      changed[index] = `${value}-changed`;
      expect(approvalManagementScopeIdentity(changed)).not.toBe(identity);
    });
  });

  it('does not collapse delimiter-like values into the same identity', () => {
    expect(approvalManagementScopeIdentity(['a|b', 'c'])).not.toBe(
      approvalManagementScopeIdentity(['a', 'b|c'])
    );
  });

  it('fails closed until the exact governed admin scope is ready', () => {
    const ready = {
      contextScopeKey: 'scope-a',
      cacheKey: ['tenant-a', 'user-a', 'NORMAL', 'approvals.admin', 'scope-a', 'revision-a'],
    };

    expect(approvalManagementScopeIsReady(ready)).toBe(true);
    expect(approvalManagementScopeIsReady({ ...ready, contextScopeKey: 'scope-b' })).toBe(false);
    expect(
      approvalManagementScopeIsReady({
        ...ready,
        cacheKey: ['tenant-a', 'user-a', 'NORMAL', 'approvals.admin.legacy', '', ''],
      })
    ).toBe(false);
    expect(approvalManagementScopeIsReady({ ...ready, ready: false })).toBe(false);
  });

  it('permits an unscoped admin request only under an explicit legacy rollout', () => {
    const legacy = {
      cacheKey: ['tenant-a', 'user-a', 'NORMAL', 'approvals.admin.legacy', '', 'legacy-revision-a'],
    };

    expect(approvalManagementScopeIsReady(legacy)).toBe(false);
    expect(approvalManagementScopeIsReady(legacy, { legacyCompatibility: true })).toBe(true);
    expect(
      approvalManagementScopeIsReady(
        { ...legacy, contextScopeKey: 'scope-a' },
        { legacyCompatibility: true }
      )
    ).toBe(false);
    expect(
      approvalManagementScopeIsReady(
        {
          cacheKey: ['', 'user-a', 'NORMAL', 'approvals.admin.legacy', '', 'legacy-revision-a'],
        },
        { legacyCompatibility: true }
      )
    ).toBe(false);
  });
});
