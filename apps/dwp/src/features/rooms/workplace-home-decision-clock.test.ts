import { describe, expect, it } from 'vitest';

import {
  latestWorkplaceDecisionInstant,
  workplaceHomeDecisionDeadline,
} from './workplace-home-decision-clock';

import type { CalendarEvent, CalendarHome, WorkplaceBooking } from '@dwp-frontend/shared-utils';

describe('workplace home decision clock', () => {
  it('uses the newest trusted source instant without moving behind the wall clock', () => {
    const wallClock = Date.parse('2026-08-19T00:00:10Z');

    expect(
      latestWorkplaceDecisionInstant(
        wallClock,
        '2026-08-19T00:00:09Z',
        '2026-08-19T00:00:12Z',
        'invalid'
      )
    ).toBe(Date.parse('2026-08-19T00:00:12Z'));
  });

  it('wakes at the nearest booking or meeting decision boundary', () => {
    const booking = {
      checkInOpensAt: '2026-08-19T00:00:20Z',
      checkInClosesAt: '2026-08-19T00:10:00Z',
      startsAt: '2026-08-19T00:30:00Z',
      endsAt: '2026-08-19T01:30:00Z',
    } as WorkplaceBooking;
    const meeting = {
      startsAt: '2026-08-19T00:00:15Z',
      endsAt: '2026-08-19T01:00:00Z',
    } as CalendarEvent;

    expect(
      workplaceHomeDecisionDeadline({
        now: '2026-08-19T00:00:10Z',
        availabilityFrom: '2026-08-19T00:01:00Z',
        bookings: [booking],
        calendar: { today: [meeting], nextEvent: meeting } as CalendarHome,
      })
    ).toBe(Date.parse('2026-08-19T00:00:15Z'));
  });

  it('ignores expired and invalid boundaries', () => {
    expect(
      workplaceHomeDecisionDeadline({
        now: '2026-08-19T00:01:00Z',
        availabilityFrom: '2026-08-19T00:01:00Z',
        calendar: {
          today: [{ startsAt: 'invalid', endsAt: '2026-08-18T23:59:00Z' }],
        } as CalendarHome,
      })
    ).toBeNull();
  });
});
