import { describe, expect, it } from 'vitest';

import { mailSharedAssignmentFilter, updateMailSharedFilters } from './mail-shared-filter';

describe('shared inbox filters', () => {
  it('fails unknown assignment values back to all', () => {
    expect(mailSharedAssignmentFilter('MINE')).toBe('MINE');
    expect(mailSharedAssignmentFilter('OVERDUE')).toBe('OVERDUE');
    expect(mailSharedAssignmentFilter('someone-else')).toBe('ALL');
  });

  it('preserves unrelated triage filters and clears stale selection', () => {
    const next = updateMailSharedFilters(new URLSearchParams('lane=PRIORITY&thread=old&page=2'), {
      assignment: 'UNASSIGNED',
      sharedInboxId: 'shared-1',
    });
    expect(next.toString()).toBe('lane=PRIORITY&assignment=UNASSIGNED&sharedInboxId=shared-1');

    expect(
      updateMailSharedFilters(new URLSearchParams(), { assignment: 'OVERDUE' }).toString()
    ).toBe('assignment=OVERDUE');
  });
});
