import { describe, expect, it } from 'vitest';

import {
  calendarEffectivePreferences,
  calendarSlotMatchesWorkingSchedule,
} from './calendar-effective-preferences';

import type { CalendarSettings } from '@dwp-frontend/shared-utils';

function settings(overrides: Partial<CalendarSettings> = {}): CalendarSettings {
  return {
    workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    workingDayStart: '09:00',
    workingDayEnd: '18:00',
    timeZone: 'Asia/Seoul',
    weekStart: 'MONDAY',
    defaultEventMinutes: 30,
    speedyMeetingMode: 'STANDARD',
    defaultBufferMinutes: 0,
    defaultVisibility: 'DETAILS',
    defaultReminderMinutes: 10,
    governance: [],
    version: 1,
    updatedAt: '2026-10-28T00:00:00Z',
    ...overrides,
  };
}

describe('calendar effective preferences', () => {
  it('uses the effective governed settings value ahead of tenant-policy fallbacks', () => {
    const preferences = calendarEffectivePreferences(
      settings({
        workingDays: ['MONDAY', 'WEDNESDAY', 'SUNDAY'],
        workingDayStart: '10:15:00',
        workingDayEnd: '17:45:00',
        timeZone: 'America/New_York',
        weekStart: 'SUNDAY',
        governance: [
          {
            key: 'WORKING_DAY_START',
            source: 'TENANT_POLICY',
            managed: true,
            inherited: true,
            locked: true,
          },
        ],
      }),
      {
        workingDayStart: '08:00',
        workingDayEnd: '19:00',
        timeZone: 'UTC',
        weekStart: 1,
      }
    );

    expect(preferences).toMatchObject({
      workingDays: ['MONDAY', 'WEDNESDAY', 'SUNDAY'],
      workingDayNumbers: [1, 3, 0],
      workingDayStart: '10:15',
      workingDayEnd: '17:45',
      timeZone: 'America/New_York',
      weekStart: 'SUNDAY',
      weekStartNumber: 0,
      workingScheduleSource: 'SETTINGS',
    });
  });

  it('falls back atomically to validated policy hours and regional preferences', () => {
    const malformed = settings({
      workingDayStart: '18:00',
      workingDayEnd: '09:00',
      timeZone: 'Not/A_Zone',
      weekStart: 'INVALID' as CalendarSettings['weekStart'],
    });
    const preferences = calendarEffectivePreferences(malformed, {
      workingDayStart: '08:00:00',
      workingDayEnd: '19:00:00',
      timeZone: 'UTC',
      weekStart: 7,
    });

    expect(preferences).toMatchObject({
      workingDayStart: '08:00',
      workingDayEnd: '19:00',
      timeZone: 'UTC',
      weekStart: 'SUNDAY',
      weekStartNumber: 0,
      workingScheduleSource: 'FALLBACK',
    });
  });

  it('filters server suggestions only when effective working-schedule evidence is available', () => {
    const preferences = calendarEffectivePreferences(
      settings({
        workingDays: ['MONDAY'],
        workingDayStart: '09:00',
        workingDayEnd: '17:00',
        timeZone: 'America/New_York',
      })
    );
    const mondaySlot = { startsAt: '2026-10-26T13:00:00Z', endsAt: '2026-10-26T14:00:00Z' };
    const sundaySlot = { startsAt: '2026-10-25T13:00:00Z', endsAt: '2026-10-25T14:00:00Z' };
    const afterHoursSlot = {
      startsAt: '2026-10-26T21:00:00Z',
      endsAt: '2026-10-26T22:00:00Z',
    };

    expect(calendarSlotMatchesWorkingSchedule(mondaySlot, preferences)).toBe(true);
    expect(calendarSlotMatchesWorkingSchedule(sundaySlot, preferences)).toBe(false);
    expect(calendarSlotMatchesWorkingSchedule(afterHoursSlot, preferences)).toBe(false);

    const fallback = calendarEffectivePreferences(undefined, {
      workingDayStart: '09:00',
      workingDayEnd: '17:00',
      timeZone: 'America/New_York',
    });
    expect(calendarSlotMatchesWorkingSchedule(sundaySlot, fallback)).toBe(true);
  });

  it('evaluates a slot across the repeated DST hour in the configured zone', () => {
    const preferences = calendarEffectivePreferences(
      settings({
        workingDays: ['SUNDAY'],
        workingDayStart: '01:00',
        workingDayEnd: '03:00',
        timeZone: 'America/New_York',
      })
    );

    expect(
      calendarSlotMatchesWorkingSchedule(
        { startsAt: '2026-11-01T05:30:00Z', endsAt: '2026-11-01T07:30:00Z' },
        preferences
      )
    ).toBe(true);
  });
});
