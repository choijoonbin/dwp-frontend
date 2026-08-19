import { describe, expect, it } from 'vitest';

import {
  roomAvailabilityRange,
  roomDateBounds,
  roomDefaultRange,
  roomLocalDate,
  roomPolicySlots,
  roomSlotAvailable,
  roomSlotOverlaps,
  validateRoomBookingRange,
} from './room-availability-model';

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

const occupancy = [
  {
    resourceId: 'room-1',
    startsAt: '2026-08-19T10:00:00+09:00',
    endsAt: '2026-08-19T11:00:00+09:00',
    bookingStatus: 'CONFIRMED' as const,
  },
];

describe('room availability model', () => {
  it('queries a browser-time-zone-independent range covering every IANA offset', () => {
    expect(roomAvailabilityRange('2026-08-19')).toEqual({
      from: '2026-08-18T10:00:00Z',
      to: '2026-08-20T12:00:00Z',
    });
  });

  it('derives the date, bounds, and default range in the resource time zone', () => {
    const now = '2026-08-19T02:00:00Z';
    expect(roomLocalDate('America/New_York', now)).toBe('2026-08-18');
    expect(roomDateBounds('Asia/Seoul', 30, now)).toEqual({
      minDate: '2026-08-19',
      maxDate: '2026-09-18',
    });
    expect(roomDefaultRange('America/New_York', policy, now)).toEqual({
      startsAt: '2026-08-19T11:00:00Z',
      endsAt: '2026-08-19T12:00:00Z',
    });
  });

  it('builds slots from Calendar policy hours in each resource time zone', () => {
    const seoul = roomPolicySlots('2026-08-19', 'Asia/Seoul', 60, policy);
    const newYork = roomPolicySlots('2026-08-19', 'America/New_York', 60, policy);

    expect(seoul.map((slot) => slot.localTime)).toEqual([
      '07:00',
      '07:30',
      '08:00',
      '08:30',
      '09:00',
    ]);
    expect(seoul[0]?.startsAt).toBe('2026-08-18T22:00:00Z');
    expect(newYork[0]?.startsAt).toBe('2026-08-19T11:00:00Z');
  });

  it('skips nonexistent local slots across a daylight-saving transition', () => {
    const transitionPolicy = {
      ...policy,
      workingDayStart: '01:30:00',
      workingDayEnd: '04:00:00',
      minimumEventMinutes: 30,
      defaultEventMinutes: 30,
    };

    expect(
      roomPolicySlots('2026-03-08', 'America/New_York', 30, transitionPolicy).map(
        (slot) => slot.localTime
      )
    ).toEqual(['01:30', '03:00', '03:30']);
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

  it('allows adjacent bookings without treating boundaries as overlap', () => {
    expect(
      roomSlotOverlaps(
        new Date('2026-08-19T09:30:00+09:00'),
        new Date('2026-08-19T10:00:00+09:00'),
        occupancy
      )
    ).toBe(false);
    expect(
      roomSlotOverlaps(
        new Date('2026-08-19T11:00:00+09:00'),
        new Date('2026-08-19T11:30:00+09:00'),
        occupancy
      )
    ).toBe(false);
  });

  it('blocks a requested duration when any portion crosses an occupied interval', () => {
    expect(
      roomSlotAvailable({
        start: new Date('2026-08-19T09:30:00+09:00'),
        end: new Date('2026-08-19T10:30:00+09:00'),
        occupancy,
        active: true,
      })
    ).toBe(false);
  });

  it('never offers slots for rooms outside active service', () => {
    expect(
      roomSlotAvailable({
        start: new Date('2026-08-19T12:00:00+09:00'),
        end: new Date('2026-08-19T12:30:00+09:00'),
        occupancy,
        active: false,
      })
    ).toBe(false);
  });
});
