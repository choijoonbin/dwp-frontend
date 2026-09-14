import { describe, expect, it } from 'vitest';

import { approvalManagementDraftBindingMatches } from './approval-management-draft-binding';

const binding = { objectId: 'draft-1', version: 4 };
const current = { ...binding, lifecycleState: 'DRAFT' };

describe('approvalManagementDraftBindingMatches', () => {
  it('accepts only the same draft identity and editor-start version', () => {
    expect(approvalManagementDraftBindingMatches(binding, current)).toBe(true);
    expect(
      approvalManagementDraftBindingMatches({ ...binding, version: 0 }, { ...current, version: 0 })
    ).toBe(true);
  });

  it.each([
    { ...current, version: 5 },
    { ...current, version: 3 },
    { ...current, objectId: 'another-draft' },
    { ...current, lifecycleState: 'PUBLISHED' },
    { ...current, lifecycleState: 'UNKNOWN' },
    undefined,
  ])('rejects changed or unavailable definitions: %j', (definition) => {
    expect(approvalManagementDraftBindingMatches(binding, definition)).toBe(false);
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsafe editor-start version %s',
    (version) => {
      expect(
        approvalManagementDraftBindingMatches({ ...binding, version }, { ...current, version })
      ).toBe(false);
    }
  );

  it('rejects a missing binding or empty identity', () => {
    expect(approvalManagementDraftBindingMatches(null, current)).toBe(false);
    expect(
      approvalManagementDraftBindingMatches(
        { ...binding, objectId: '' },
        { ...current, objectId: '' }
      )
    ).toBe(false);
  });
});
