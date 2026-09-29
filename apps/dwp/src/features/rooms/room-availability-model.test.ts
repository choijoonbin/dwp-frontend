import { describe, expect, it } from 'vitest';

import { roomDefaultRange, validateRoomBookingRange } from './room-availability-model';

import type { CalendarPolicy } from '@dwp-frontend/shared-utils';

const policy: CalendarPolicy = {
  weekStart: 1,
  workingDayStart: '07:00:00',
  workingDayEnd: '10:00:00',
  defaultEventMinutes: 60,
  minimumEventMinutes: 30,
  maximumEventMinutes: 120,
  maximumAdvanceDays: 30,
  defaultBufferMinutes: 0,
  weeklyFocusTargetMinutes: 240,
  dailyMeetingLimitMinutes: 480,
  enforceMeetingAgenda: false,
  allowExternalAttendees: false,
  version: 1,
};

describe('room availability model', () => {
  it('derives the default range in the resource time zone', () => {
    const now = '2026-08-19T02:00:00Z';
    expect(roomDefaultRange('America/New_York', policy, now)).toEqual({
      startsAt: '2026-08-19T11:00:00Z',
      endsAt: '2026-08-19T12:00:00Z',
    });
  });

  it('moves the default range to the next working day when it would overrun closing time', () => {
    expect(roomDefaultRange('America/New_York', policy, '2026-08-19T13:20:00Z')).toEqual({
      startsAt: '2026-08-20T11:00:00Z',
      endsAt: '2026-08-20T12:00:00Z',
    });
  });

  it('validates Calendar duration, advance window, and local operating hours', () => {
    expect(
      validateRoomBookingRange(
        '2026-08-18T22:00:00Z',
        '2026-08-18T23:00:00Z',
        'Asia/Seoul',
        policy,
        '2026-08-18T00:00:00Z'
      )
    ).toBeNull();
    expect(
      validateRoomBookingRange(
        '2026-08-19T01:00:00Z',
        '2026-08-19T02:00:00Z',
        'Asia/Seoul',
        policy,
        '2026-08-18T00:00:00Z'
      )
    ).toBe('hours');
  });
});
