import { describe, expect, it } from 'vitest';

import {
  calendarScheduleCalendarIds,
  calendarScheduleDate,
  calendarScheduleDateValue,
  calendarScheduleSavedConfiguration,
  calendarScheduleSearchParams,
  calendarScheduleStateFromSavedView,
  calendarScheduleView,
  fullCalendarView,
  scheduleViewFromFullCalendar,
} from './calendar-schedule-state';

describe('calendar schedule state', () => {
  it('validates views and maps them to the calendar renderer contract', () => {
    expect(calendarScheduleView('month', 'week')).toBe('month');
    expect(calendarScheduleView('invalid', 'week')).toBe('week');
    expect(fullCalendarView('agenda')).toBe('listMonth');
    expect(scheduleViewFromFullCalendar('timeGridDay')).toBe('day');
  });

  it('round-trips a local calendar date without UTC day drift', () => {
    const date = calendarScheduleDate('2026-08-27', new Date('2020-01-01T00:00:00Z'));
    expect(calendarScheduleDateValue(date)).toBe('2026-08-27');
    expect(calendarScheduleDate('not-a-date', new Date(2026, 7, 28)).getDate()).toBe(28);
  });

  it('parses, deduplicates, and explicitly preserves an empty calendar selection', () => {
    expect(calendarScheduleCalendarIds('b,a,b')).toEqual(['b', 'a']);
    expect(calendarScheduleCalendarIds('none')).toEqual([]);
    expect(calendarScheduleCalendarIds(undefined)).toBeNull();
  });

  it('merges schedule state without dropping unrelated deep-link parameters', () => {
    const next = calendarScheduleSearchParams(new URLSearchParams('event=e-1&create=focus'), {
      view: 'month',
      date: new Date(2026, 7, 27),
      calendarIds: ['team', 'personal'],
    });

    expect(next.get('event')).toBe('e-1');
    expect(next.get('create')).toBe('focus');
    expect(next.get('view')).toBe('month');
    expect(next.get('date')).toBe('2026-08-27');
    expect(next.get('calendars')).toBe('personal,team');
  });

  it('normalizes governed saved-view configuration and keeps safe fallbacks', () => {
    const fallback = {
      view: 'week' as const,
      date: new Date(2026, 7, 27),
      calendarIds: ['personal'],
    };
    const state = calendarScheduleStateFromSavedView(
      { view: 'agenda', date: '2026-09-02', calendarIds: ['team', 'team'] },
      fallback
    );

    expect(state.view).toBe('agenda');
    expect(calendarScheduleDateValue(state.date)).toBe('2026-09-02');
    expect(state.calendarIds).toEqual(['team']);
    expect(calendarScheduleSavedConfiguration(state)).toEqual({
      schemaVersion: 1,
      view: 'agenda',
      date: '2026-09-02',
      calendarIds: ['team'],
    });
  });
});
