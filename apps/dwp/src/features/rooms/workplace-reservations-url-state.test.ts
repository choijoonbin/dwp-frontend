import { describe, expect, it } from 'vitest';

import {
  migrateLegacyWorkplaceReservationsUrl,
  parseWorkplaceReservationsUrl,
  updateWorkplaceReservationsUrl,
  workplaceReservationsRange,
} from './workplace-reservations-url-state';

describe('workplace reservations URL state', () => {
  it('normalizes unsupported and unsafe values to a versioned canonical state', () => {
    const parsed = parseWorkplaceReservationsUrl(
      new URLSearchParams(
        'v=77&period=FOREVER&types=SECRET&status=UNKNOWN&authority=ROOT&q=%00++focus++&token=secret'
      )
    );

    expect(parsed.state).toEqual({
      period: 'UPCOMING',
      type: 'ALL',
      status: 'ACTIVE',
      authority: 'ALL',
      query: 'focus',
      reservationId: null,
      reservationAuthority: null,
    });
    expect(parsed.canonicalSearchParams.toString()).toBe(
      'v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL&q=focus'
    );
    expect(parsed.corrected).toBe(true);
  });

  it('updates filters while preserving a selected reservation', () => {
    const next = updateWorkplaceReservationsUrl(
      new URLSearchParams(
        'v=1&period=WEEK&types=ALL&status=ACTIVE&authority=ALL&reservation=booking%2F1&reservationAuthority=WORKPLACE'
      ),
      { types: 'DESK', status: 'CHECKED_IN' }
    );

    expect(next.toString()).toBe(
      'v=1&period=WEEK&types=DESK&status=CHECKED_IN&authority=ALL&reservation=booking%2F1&reservationAuthority=WORKPLACE'
    );
  });

  it('migrates both legacy details without mixing their write authorities', () => {
    const workplace = migrateLegacyWorkplaceReservationsUrl(
      new URLSearchParams('booking=desk%2F1&period=TODAY'),
      'my-bookings'
    );
    const calendar = migrateLegacyWorkplaceReservationsUrl(
      new URLSearchParams('event=event%2F1&period=WEEK'),
      'my-meetings'
    );

    expect(workplace.toString()).toContain('types=WORKSPACE');
    expect(workplace.toString()).toContain('authority=WORKPLACE');
    expect(workplace.toString()).toContain('reservation=desk%2F1');
    expect(workplace.toString()).toContain('reservationAuthority=WORKPLACE');
    expect(calendar.toString()).toContain('types=MEETING');
    expect(calendar.toString()).toContain('authority=CALENDAR');
    expect(calendar.toString()).toContain('reservation=event%2F1');
    expect(calendar.toString()).toContain('reservationAuthority=CALENDAR');
  });

  it('creates deterministic today, week, upcoming, and past query windows', () => {
    const now = new Date('2026-09-16T05:30:00.000Z');
    expect(workplaceReservationsRange('UPCOMING', now).to).toBe('2027-09-16T05:30:00.000Z');
    expect(workplaceReservationsRange('PAST', now).from).toBe('2025-09-16T05:30:00.000Z');
    expect(
      Date.parse(workplaceReservationsRange('WEEK', now).to) -
        Date.parse(workplaceReservationsRange('WEEK', now).from)
    ).toBe(7 * 24 * 60 * 60 * 1000);
    expect(
      Date.parse(workplaceReservationsRange('TODAY', now).to) -
        Date.parse(workplaceReservationsRange('TODAY', now).from)
    ).toBe(24 * 60 * 60 * 1000);
  });
});
