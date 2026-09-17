import { describe, expect, it } from 'vitest';

import { summarizeWorkplaceDataSources } from './workplace-governance-data-sources';

describe('Workplace data-source operations', () => {
  it('keeps saved configuration separate from verified operation', () => {
    expect(
      summarizeWorkplaceDataSources([
        { status: 'CONFIGURED_UNVERIFIED' },
        { status: 'CONFIGURED_UNVERIFIED' },
        { status: 'DISABLED' },
        { status: 'NOT_CONFIGURED' },
      ])
    ).toEqual({ total: 4, configured: 2, disabled: 1, missing: 1 });
  });
});
