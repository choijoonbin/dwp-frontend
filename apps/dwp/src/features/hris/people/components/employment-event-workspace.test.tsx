import { describe, expect, it } from 'vitest';

import { employmentEventActionLabel } from './employment-event-workspace';

describe('employment event workspace lifecycle', () => {
  it('waits for approval and requires an injected publisher before offering publish', () => {
    expect(employmentEventActionLabel(null, false)).toBe('Create event');
    expect(employmentEventActionLabel('DRAFT', false)).toBe('Validate impact');
    expect(employmentEventActionLabel('VALIDATED', false)).toBe('Submit for approval');
    expect(employmentEventActionLabel('PENDING_APPROVAL', false)).toBe('Refresh status');
    expect(employmentEventActionLabel('APPROVED', false)).toBe('Refresh status');
    expect(employmentEventActionLabel('APPROVED', true)).toBe('Publish');
  });
});
