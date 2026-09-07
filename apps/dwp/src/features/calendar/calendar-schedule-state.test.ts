import { describe, expect, it } from 'vitest';

import {
  calendarInternalPath,
  calendarScheduleCalendarIds,
  calendarScheduleDate,
  calendarScheduleDateValue,
  calendarScheduleSavedConfiguration,
  calendarScheduleSearchParams,
  calendarScheduleStateFromSavedView,
  calendarScheduleView,
  fullCalendarView,
  isCalendarCommandShortcut,
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

  it('preserves every opaque scope value during calendar-internal navigation', () => {
    const current = new URLSearchParams(
      'scope=tenant%2Fmember&scope=duplicate&view=week&date=2026-08-27&calendars=personal'
    );

    const focus = new URL(calendarInternalPath('/calendar/focus', current), 'https://dwp.test');
    expect(focus.pathname).toBe('/calendar/focus');
    expect(focus.searchParams.getAll('scope')).toEqual(['tenant/member', 'duplicate']);
    expect(focus.searchParams.has('view')).toBe(false);

    const schedule = new URL(
      calendarInternalPath('/calendar/schedule', current, { preserveScheduleState: true }),
      'https://dwp.test'
    );
    expect(schedule.searchParams.getAll('scope')).toEqual(['tenant/member', 'duplicate']);
    expect(schedule.searchParams.get('view')).toBe('week');
    expect(schedule.searchParams.get('date')).toBe('2026-08-27');
    expect(schedule.searchParams.get('calendars')).toBe('personal');
  });

  it('opens calendar commands only for an unclaimed platform shortcut outside editors', () => {
    const shortcut = (overrides: Partial<KeyboardEvent> = {}) =>
      ({
        target: null,
        defaultPrevented: false,
        metaKey: true,
        ctrlKey: false,
        key: '/',
        ...overrides,
      }) as KeyboardEvent;

    expect(isCalendarCommandShortcut(shortcut())).toBe(true);
    expect(isCalendarCommandShortcut(shortcut({ metaKey: false, ctrlKey: true }))).toBe(true);
    expect(isCalendarCommandShortcut(shortcut({ defaultPrevented: true }))).toBe(false);
    expect(isCalendarCommandShortcut(shortcut({ isComposing: true }))).toBe(false);
    expect(
      isCalendarCommandShortcut(shortcut({ target: { tagName: 'INPUT' } as HTMLElement }))
    ).toBe(false);
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
