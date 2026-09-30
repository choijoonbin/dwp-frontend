import { describe, expect, it } from 'vitest';

import { canManageProviderResourceGovernance } from './provider-resource-governance-access';

describe('resource governance tenant-selection boundary', () => {
  it('does not expose any tenant-targeted mutation to a writer without estate read access', () => {
    expect(canManageProviderResourceGovernance(true, false)).toBe(false);
    expect(canManageProviderResourceGovernance(false, true)).toBe(false);
    expect(canManageProviderResourceGovernance(true, true)).toBe(true);
  });
});
