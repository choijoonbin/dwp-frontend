import { describe, expect, it } from 'vitest';

import { previewRoomBookingRecurrence, roomBookingRecurrenceDays } from './room-booking-recurrence';

import type { CalendarPolicy } from '@dwp-frontend/shared-utils';

const policy: CalendarPolicy = {
  weekStart: 1,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 15,
  maximumEventMinutes: 480,
  maximumAdvanceDays: 60,
  defaultBufferMinutes: 0,
  weeklyFocusTargetMinutes: 240,
  dailyMeetingLimitMinutes: 480,
  enforceMeetingAgenda: false,
  allowExternalAttendees: false,
  version: 3,
};

describe('room booking recurrence preview', () => {
  it('projects a finite inclusive series in the room time zone', () => {
    expect(
      previewRoomBookingRecurrence({
        recurrence: 'WEEKLY',
        interval: 2,
        until: '2026-11-24',
        startsAt: '2026-11-10T01:00:00Z',
        timeZone: 'Asia/Seoul',
        policy,
        now: '2026-10-28T00:00:00Z',
      })
    ).toEqual({ dates: ['2026-11-10', '2026-11-24'], error: null });
  });

  it('rejects a one-occurrence pseudo-series and an end date beyond the policy horizon', () => {
    expect(
      previewRoomBookingRecurrence({
        recurrence: 'DAILY',
        interval: 1,
        until: '2026-11-10',
        startsAt: '2026-11-10T01:00:00Z',
        timeZone: 'Asia/Seoul',
        policy,
        now: '2026-10-28T00:00:00Z',
      }).error
    ).toBe('occurrences');
    expect(
      previewRoomBookingRecurrence({
        recurrence: 'MONTHLY',
        interval: 1,
        until: '2027-03-10',
        startsAt: '2026-11-10T01:00:00Z',
        timeZone: 'Asia/Seoul',
        policy,
        now: '2026-10-28T00:00:00Z',
      }).error
    ).toBe('window');
  });

  it('projects yearly recurrence by years instead of treating it as monthly', () => {
    expect(
      previewRoomBookingRecurrence({
        recurrence: 'YEARLY',
        interval: 1,
        until: '2028-02-29',
        startsAt: '2026-02-28T01:00:00Z',
        timeZone: 'Asia/Seoul',
        policy: { ...policy, maximumAdvanceDays: 800 },
        now: '2026-01-01T00:00:00Z',
      })
    ).toEqual({ dates: ['2026-02-28', '2027-02-28', '2028-02-28'], error: null });
  });

  it('emits the room-local weekly anchor and preserves existing weekly days', () => {
    expect(
      roomBookingRecurrenceDays('WEEKLY', '2026-11-01T23:30:00Z', 'Asia/Seoul', ['WEDNESDAY'])
    ).toEqual(['MONDAY', 'WEDNESDAY']);
    expect(roomBookingRecurrenceDays('YEARLY', '2026-11-01T23:30:00Z', 'Asia/Seoul')).toEqual([]);
  });
});
