import { describe, expect, it } from 'vitest';

import {
  providerAuditCategory,
  providerAuditOutcome,
  providerAuditSnapshotFieldCount,
} from './provider-audit-presentation';

describe('provider audit presentation', () => {
  it('fails closed for unknown category and outcome codes', () => {
    expect(providerAuditCategory('CHANGE')).toBe('CHANGE');
    expect(providerAuditCategory('INTERNAL_EVENT')).toBe('UNAVAILABLE');
    expect(providerAuditOutcome('SUCCESS')).toBe('SUCCESS');
    expect(providerAuditOutcome('INTERNAL_RESULT')).toBe('UNAVAILABLE');
  });

  it('summarizes redacted evidence without returning raw JSON', () => {
    expect(providerAuditSnapshotFieldCount('{"tenant":"redacted","count":2}')).toBe(2);
    expect(providerAuditSnapshotFieldCount('not-json')).toBeNull();
    expect(providerAuditSnapshotFieldCount(['internal'])).toBeNull();
  });
});
