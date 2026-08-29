import { describe, expect, it } from 'vitest';

import {
  workplaceBookingInstantMatches,
  workplaceBookingSourceVerified,
} from './workplace-booking-source-snapshot';

const expected = {
  resourceId: 'resource-1',
  resourceVersion: 3,
  rangeFrom: '2026-08-29T01:00:00Z',
  rangeTo: '2026-08-29T02:00:00Z',
  policyVersion: 7,
};

const snapshot = {
  identityKey: 'tenant-1:user-1',
  ...expected,
  generatedAt: '2026-08-29T00:59:00Z',
};

describe('workplace booking source snapshot', () => {
  it('matches semantically identical instants across server and browser ISO formats', () => {
    expect(workplaceBookingInstantMatches('2026-08-29T01:00:00Z', '2026-08-29T01:00:00.000Z')).toBe(
      true
    );
    expect(
      workplaceBookingInstantMatches('2026-08-29T10:00:00+09:00', '2026-08-29T01:00:00Z')
    ).toBe(true);
    expect(workplaceBookingInstantMatches('2026-08-29T01:00:01Z', '2026-08-29T01:00:00Z')).toBe(
      false
    );
  });

  it('requires the latest identity-bound resource, range, and policy snapshot', () => {
    expect(workplaceBookingSourceVerified(snapshot, expected)).toBe(true);
    expect(workplaceBookingSourceVerified(null, expected)).toBe(false);
    expect(workplaceBookingSourceVerified(snapshot, { ...expected, resourceVersion: 4 })).toBe(
      false
    );
    expect(
      workplaceBookingSourceVerified(snapshot, {
        ...expected,
        rangeTo: '2026-08-29T02:30:00Z',
      })
    ).toBe(false);
  });

  it('keeps non-Explore callers backward compatible when no snapshot contract is supplied', () => {
    expect(workplaceBookingSourceVerified(undefined, expected)).toBe(true);
  });

  it('requires an exact owner eligibility evaluation when requested', () => {
    expect(
      workplaceBookingSourceVerified(snapshot, {
        ...expected,
        requireBookingEligibility: true,
      })
    ).toBe(false);

    const eligible = {
      ...snapshot,
      bookingEligibility: {
        evaluatedAt: snapshot.generatedAt,
        excludedEventId: 'event-1',
      },
    };
    expect(
      workplaceBookingSourceVerified(eligible, {
        ...expected,
        requireBookingEligibility: true,
        excludedEventId: 'event-1',
      })
    ).toBe(true);
    expect(
      workplaceBookingSourceVerified(eligible, {
        ...expected,
        requireBookingEligibility: true,
        excludedEventId: 'event-2',
      })
    ).toBe(false);
  });
});
