import { describe, expect, it } from 'vitest';

import {
  validateWorkplaceBookingRange,
  workplaceDefaultSelection,
  workplaceRange,
  workplaceTimeOptions,
} from './workplace-time-policy';

import type { WorkplacePolicy } from '@dwp-frontend/shared-utils';

const policy: WorkplacePolicy = {
  bookingWindowDays: 30,
  bookingRetentionDays: 365,
  maximumActiveBookings: 20,
  minimumBookingMinutes: 30,
  maximumBookingMinutes: 480,
  maximumConsecutiveDays: 5,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  allowRecurring: false,
  requireCheckIn: true,
  checkInLeadMinutes: 30,
  autoReleaseMinutes: 30,
  allowAssignedDeskLending: false,
  showColleagueNames: true,
  version: 0,
};

describe('Workplace site time policy', () => {
  it('converts a selected site-local time to an absolute instant', () => {
    expect(workplaceRange('2026-08-19', '09:00', 60, 'Asia/Seoul')).toEqual({
      from: '2026-08-19T00:00:00Z',
      to: '2026-08-19T01:00:00Z',
    });
    expect(workplaceRange('2026-08-19', '09:00', 60, 'America/New_York')).toEqual({
      from: '2026-08-19T13:00:00Z',
      to: '2026-08-19T14:00:00Z',
    });
  });

  it('rejects a nonexistent daylight-saving wall clock time', () => {
    expect(() => workplaceRange('2026-03-08', '02:30', 60, 'America/New_York')).toThrow();
  });

  it('derives selectable times from the tenant policy', () => {
    const values = workplaceTimeOptions('07:00:00', '09:00:00', 60).map(({ value }) => value);
    expect(values).toEqual(['07:00', '07:30', '08:00']);
  });

  it('chooses the next slot in the selected site time zone', () => {
    expect(workplaceDefaultSelection('Asia/Seoul', policy, '2026-08-19T00:00:00Z')).toEqual({
      date: '2026-08-19',
      time: '09:30',
    });
    expect(workplaceDefaultSelection('America/New_York', policy, '2026-08-19T02:00:00Z')).toEqual({
      date: '2026-08-19',
      time: '08:00',
    });
  });

  it('validates duration and site-local working hours', () => {
    expect(
      validateWorkplaceBookingRange(
        '2026-08-19T00:00:00Z',
        '2026-08-19T01:00:00Z',
        'Asia/Seoul',
        policy,
        '2026-08-18T00:00:00Z'
      )
    ).toBeNull();
    expect(
      validateWorkplaceBookingRange(
        '2026-08-19T11:30:00Z',
        '2026-08-19T12:30:00Z',
        'Asia/Seoul',
        policy,
        '2026-08-18T00:00:00Z'
      )
    ).toBe('hours');
  });
});
