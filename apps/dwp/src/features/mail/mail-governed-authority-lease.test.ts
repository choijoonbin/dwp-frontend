import { describe, expect, it } from 'vitest';

import { resolveMailGovernedAuthorityLease } from './mail-governed-authority-lease';

describe('Mail governed authority lease', () => {
  it('has no client-side expiry for explicit legacy compatibility', () => {
    expect(
      resolveMailGovernedAuthorityLease({
        mode: 'LEGACY_COMPATIBILITY',
        rolloutState: '100',
      })
    ).toEqual({ expiresAt: null, key: 'legacy:100' });
  });

  it('uses the earliest decision revalidation or scope expiry instant', () => {
    expect(
      resolveMailGovernedAuthorityLease({
        mode: 'SECURE',
        rolloutState: '111',
        contextScopeKey: 'mail-scope',
        expectedDecisionRevision: 'revision-1',
        revalidateAt: '2026-10-28T10:05:00.000Z',
        scopeValidUntil: '2026-10-28T10:03:00.000Z',
        eligibleContextScopeKeys: ['mail-scope'],
      }).expiresAt
    ).toBe(Date.parse('2026-10-28T10:03:00.000Z'));
  });
});
