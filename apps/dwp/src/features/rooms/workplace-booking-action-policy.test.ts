import { describe, expect, it } from 'vitest';

import { workplaceBookingActionPolicy } from './workplace-booking-action-policy';

import type {
  WorkplaceBookingActionPolicy,
  WorkplaceBookingActionPolicyInput,
} from './workplace-booking-action-policy';
import type { WorkplaceHomeSourceState } from './workplace-home-source-state';
import type { WorkplaceBooking } from '@dwp-frontend/shared-utils';

const STARTS_AT = '2026-08-19T00:30:00Z';
const ENDS_AT = '2026-08-19T01:30:00Z';
const CHECK_IN_OPENS_AT = '2026-08-19T00:00:00Z';
const CHECK_IN_CLOSES_AT = '2026-08-19T00:45:00Z';
const CLOSED = { canCheckIn: false, canRelease: false, canCancel: false };

function booking(overrides: Partial<WorkplaceBooking> = {}): WorkplaceBooking {
  return {
    bookingId: '40000000-0000-4000-8000-000000000001',
    resourceId: '30000000-0000-4000-8000-000000000001',
    resourceName: 'Focus desk 12',
    resourceType: 'DESK',
    siteName: 'Seoul HQ',
    floorName: '12F',
    purpose: null,
    startsAt: STARTS_AT,
    endsAt: ENDS_AT,
    status: 'RESERVED',
    visibleToColleagues: false,
    checkedInAt: null,
    releasedAt: null,
    canCheckIn: true,
    canCancel: true,
    canRelease: true,
    checkInOpensAt: CHECK_IN_OPENS_AT,
    checkInClosesAt: CHECK_IN_CLOSES_AT,
    version: 1,
    ...overrides,
  };
}

function policy(now: string | number, overrides: Partial<WorkplaceBookingActionPolicyInput> = {}) {
  return workplaceBookingActionPolicy({
    booking: booking(),
    sourceState: 'READY',
    canUpdateWorkplaceBooking: true,
    nowInstant: typeof now === 'number' ? now : Date.parse(now),
    ...overrides,
  });
}

describe('workplaceBookingActionPolicy', () => {
  it.each<{
    label: string;
    now: string;
    expected: WorkplaceBookingActionPolicy;
  }>([
    {
      label: 'opens check-in inclusively at its opening boundary',
      now: CHECK_IN_OPENS_AT,
      expected: { canCheckIn: true, canRelease: false, canCancel: true },
    },
    {
      label: 'opens release inclusively at the reservation start',
      now: STARTS_AT,
      expected: { canCheckIn: true, canRelease: true, canCancel: false },
    },
    {
      label: 'keeps check-in open inclusively at its closing boundary',
      now: CHECK_IN_CLOSES_AT,
      expected: { canCheckIn: true, canRelease: true, canCancel: false },
    },
    {
      label: 'closes both active writes exactly at the reservation end',
      now: ENDS_AT,
      expected: CLOSED,
    },
  ])('$label', ({ now, expected }) => {
    expect(policy(now)).toEqual(expected);
  });

  it('keeps each write closed immediately outside its authorized interval', () => {
    expect(policy('2026-08-18T23:59:59.999Z')).toEqual({
      canCheckIn: false,
      canRelease: false,
      canCancel: true,
    });
    expect(policy('2026-08-19T00:45:00.001Z')).toEqual({
      canCheckIn: false,
      canRelease: true,
      canCancel: false,
    });
    expect(policy('2026-08-19T01:29:59.999Z')).toEqual({
      canCheckIn: false,
      canRelease: true,
      canCancel: false,
    });
  });

  it.each<WorkplaceHomeSourceState>(['LOADING', 'STALE', 'DENIED', 'UNAVAILABLE', 'SKIPPED'])(
    'fails closed while the booking source is %s',
    (sourceState) => {
      expect(policy(STARTS_AT, { sourceState })).toEqual(CLOSED);
    }
  );

  it('requires the update capability', () => {
    expect(policy(STARTS_AT, { canUpdateWorkplaceBooking: false })).toEqual(CLOSED);
  });

  it.each([
    {
      label: 'check-in',
      now: CHECK_IN_OPENS_AT,
      booking: booking({ canCheckIn: false }),
      expected: { canCheckIn: false, canRelease: false, canCancel: true },
    },
    {
      label: 'release',
      now: STARTS_AT,
      booking: booking({ canRelease: false }),
      expected: { canCheckIn: true, canRelease: false, canCancel: false },
    },
    {
      label: 'cancel',
      now: CHECK_IN_OPENS_AT,
      booking: booking({ canCancel: false }),
      expected: { canCheckIn: true, canRelease: false, canCancel: false },
    },
  ])('requires the server-owned $label flag', ({ now, booking: value, expected }) => {
    expect(policy(now, { booking: value })).toEqual(expected);
  });

  it.each(['COMPLETED', 'NO_SHOW', 'RELEASED', 'CANCELLED'] as const)(
    'fails closed for terminal status %s',
    (status) => {
      expect(policy(STARTS_AT, { booking: booking({ status }) })).toEqual(CLOSED);
    }
  );

  it('allows only release for a checked-in reservation inside the active interval', () => {
    expect(
      policy(STARTS_AT, {
        booking: booking({ status: 'CHECKED_IN' }),
      })
    ).toEqual({ canCheckIn: false, canRelease: true, canCancel: false });
  });

  it.each([
    ['not-a-number', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
  ])('fails closed for %s authority time', (_label, nowInstant) => {
    expect(policy(nowInstant)).toEqual(CLOSED);
  });

  it.each([
    ['invalid start', { startsAt: 'invalid' }],
    ['invalid end', { endsAt: 'invalid' }],
    ['invalid check-in opening', { checkInOpensAt: 'invalid' }],
    ['invalid check-in closing', { checkInClosesAt: 'invalid' }],
    ['reservation rollback', { startsAt: ENDS_AT, endsAt: STARTS_AT }],
    [
      'check-in window rollback',
      { checkInOpensAt: CHECK_IN_CLOSES_AT, checkInClosesAt: CHECK_IN_OPENS_AT },
    ],
  ] as const)('fails closed for %s timestamps', (_label, timestamps) => {
    expect(policy(STARTS_AT, { booking: booking(timestamps) })).toEqual(CLOSED);
  });
});
