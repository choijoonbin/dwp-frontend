import { describe, expect, it } from 'vitest';

import {
  isFuturePrivilegedAccessDateTime,
  isOptionalFuturePrivilegedAccessDateTime,
} from './privileged-access-validation';

describe('privileged access date-time validation', () => {
  const now = Date.parse('2026-08-28T00:00:00Z');

  it('requires emergency review times to be valid future instants', () => {
    expect(isFuturePrivilegedAccessDateTime(null, now)).toBe(false);
    expect(isFuturePrivilegedAccessDateTime('not-a-date', now)).toBe(false);
    expect(isFuturePrivilegedAccessDateTime('2026-08-28T00:00:00Z', now)).toBe(false);
    expect(isFuturePrivilegedAccessDateTime('2026-08-28T00:00:01Z', now)).toBe(true);
  });

  it('allows an omitted eligibility expiry but rejects a supplied non-future instant', () => {
    expect(isOptionalFuturePrivilegedAccessDateTime(null, now)).toBe(true);
    expect(isOptionalFuturePrivilegedAccessDateTime('', now)).toBe(true);
    expect(isOptionalFuturePrivilegedAccessDateTime('2026-08-27T23:59:59Z', now)).toBe(false);
    expect(isOptionalFuturePrivilegedAccessDateTime('2026-09-01T00:00:00Z', now)).toBe(true);
  });
});
