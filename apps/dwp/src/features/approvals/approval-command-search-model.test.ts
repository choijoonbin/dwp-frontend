import { describe, expect, it } from 'vitest';

import {
  approvalTaskSearchFilters,
  hasSameApprovalSearchScope,
} from './use-approval-command-task-search';

describe('approval command server search filters', () => {
  it('never retains placeholder rows across tenant, actor, access mode, surface, scope or revision changes', () => {
    const key = [
      'approvals',
      'command-tasks',
      'INBOX',
      'tenant',
      'actor',
      'NORMAL',
      'approvals.work',
      'scope',
      'revision',
      { page: 0 },
      'day',
    ];
    expect(hasSameApprovalSearchScope(key, [...key.slice(0, 9), { page: 1 }, 'day'], 6)).toBe(true);
    for (let index = 3; index < 9; index += 1) {
      const next = [...key];
      next[index] = 'changed';
      expect(hasSameApprovalSearchScope(key, next, 6)).toBe(false);
    }
  });
  it('keeps full-result paging, status and sorting on every queue', () => {
    for (const queue of ['ALL', 'URGENT', 'DUE_TODAY', 'HIGH_RISK'] as const) {
      expect(approvalTaskSearchFilters(queue, '  Finance  ', 4, 'OLDEST', 'CLAIMED')).toMatchObject(
        { query: 'Finance', page: 4, size: 25, sort: 'OLDEST', status: 'CLAIMED' }
      );
    }
  });
  it('uses the existing risk boundary and tenant-day evaluation rather than local slicing', () => {
    expect(approvalTaskSearchFilters('HIGH_RISK', '', 0, 'PRIORITY', '')).toHaveProperty(
      'minRiskScore',
      70
    );
    expect(approvalTaskSearchFilters('DUE_TODAY', '', 0, 'PRIORITY', '')).toHaveProperty(
      'due',
      'TODAY'
    );
    expect(approvalTaskSearchFilters('URGENT', '', 0, 'PRIORITY', '')).toHaveProperty(
      'priority',
      'URGENT'
    );
    expect(approvalTaskSearchFilters('ALL', '', 0, 'PRIORITY', '')).not.toHaveProperty(
      'minRiskScore'
    );
  });
});
