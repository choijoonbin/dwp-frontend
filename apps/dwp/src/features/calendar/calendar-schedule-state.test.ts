import { describe, expect, it } from 'vitest';

import {
  authorizedCalendarWorkReturnTarget,
  calendarInternalPath,
  calendarScheduleAuthorizedEvent,
  calendarScheduleCalendarIds,
  calendarScheduleDate,
  calendarScheduleDateValue,
  calendarScheduleInitialRange,
  calendarScheduleReturnTarget,
  calendarScheduleSavedConfiguration,
  calendarScheduleSearchParams,
  calendarScheduleStateFromSavedView,
  calendarScheduleView,
  fullCalendarView,
  isCalendarCommandShortcut,
  scheduleViewFromFullCalendar,
  sameCalendarSelection,
} from './calendar-schedule-state';

describe('calendar schedule state', () => {
  it('removes an open event when a successful refresh no longer authorizes it', () => {
    const event = { eventId: 'event-revoked', title: 'Private planning' };

    expect(calendarScheduleAuthorizedEvent(event, new Set(['event-visible']))).toBeNull();
    expect(calendarScheduleAuthorizedEvent(event, new Set(['event-revoked']))).toBe(event);
    expect(calendarScheduleAuthorizedEvent(null, new Set(['event-revoked']))).toBeNull();
  });

  it('validates views and maps them to the calendar renderer contract', () => {
    expect(calendarScheduleView('month', 'week')).toBe('month');
    expect(calendarScheduleView('threeDay', 'week')).toBe('threeDay');
    expect(calendarScheduleView('fourDay', 'week')).toBe('fourDay');
    expect(calendarScheduleView('invalid', 'week')).toBe('week');
    expect(fullCalendarView('agenda')).toBe('listMonth');
    expect(fullCalendarView('threeDay')).toBe('timeGridThreeDay');
    expect(fullCalendarView('fourDay')).toBe('timeGridFourDay');
    expect(scheduleViewFromFullCalendar('timeGridDay')).toBe('day');
    expect(scheduleViewFromFullCalendar('timeGridThreeDay')).toBe('threeDay');
    expect(scheduleViewFromFullCalendar('timeGridFourDay')).toBe('fourDay');
  });

  it('round-trips a local calendar date without UTC day drift', () => {
    const date = calendarScheduleDate('2026-08-27', new Date('2020-01-01T00:00:00Z'));
    expect(calendarScheduleDateValue(date)).toBe('2026-08-27');
    expect(calendarScheduleDate('not-a-date', new Date(2026, 7, 28)).getDate()).toBe(28);
  });

  it('owns the initial Monday range and exact source-selection comparison', () => {
    expect(calendarScheduleInitialRange(new Date(2026, 7, 27, 12))).toEqual({
      from: new Date(2026, 7, 24).toISOString(),
      to: new Date(2026, 7, 31).toISOString(),
    });
    expect(sameCalendarSelection(['personal', 'team'], ['personal', 'team'])).toBe(true);
    expect(sameCalendarSelection(['personal', 'team'], ['team', 'personal'])).toBe(false);
  });

  it('parses, deduplicates, and explicitly preserves an empty calendar selection', () => {
    expect(calendarScheduleCalendarIds('b,a,b')).toEqual(['b', 'a']);
    expect(calendarScheduleCalendarIds('none')).toEqual([]);
    expect(calendarScheduleCalendarIds(undefined)).toBeNull();
  });

  it('merges schedule state without dropping unrelated deep-link parameters', () => {
    const next = calendarScheduleSearchParams(
      new URLSearchParams('event=e-1&create=focus&returnTo=%2Fwork%2Fqueue%3Fscope%3Dmine'),
      {
        view: 'month',
        date: new Date(2026, 7, 27),
        calendarIds: ['team', 'personal'],
      }
    );

    expect(next.get('event')).toBe('e-1');
    expect(next.get('create')).toBe('focus');
    expect(next.get('view')).toBe('month');
    expect(next.get('date')).toBe('2026-08-27');
    expect(next.get('calendars')).toBe('personal,team');
    expect(next.get('returnTo')).toBe('/work/queue?scope=mine');
  });

  it('accepts only canonical internal Work return targets', () => {
    expect(calendarScheduleReturnTarget('/work/queue?scope=mine#task-42')).toBe(
      '/work/queue?scope=mine#task-42'
    );
    expect(calendarScheduleReturnTarget('/work')).toBe('/work');

    expect(calendarScheduleReturnTarget('https://evil.test/work')).toBeNull();
    expect(calendarScheduleReturnTarget('//evil.test/work')).toBeNull();
    expect(calendarScheduleReturnTarget('/calendar/schedule')).toBeNull();
    expect(calendarScheduleReturnTarget('/work/../admin')).toBeNull();
    expect(calendarScheduleReturnTarget('/work\\queue')).toBeNull();
    expect(calendarScheduleReturnTarget('/work/%5cadmin')).toBeNull();
    expect(calendarScheduleReturnTarget('/work/%2e%2e/admin')).toBeNull();
    expect(calendarScheduleReturnTarget('/work/queue\u0000')).toBeNull();
    expect(calendarScheduleReturnTarget('/work/queue?filter=%0A')).toBeNull();
    expect(calendarScheduleReturnTarget(`/work/${'a'.repeat(2_048)}`)).toBeNull();
  });

  it('requires an explicit non-denied Work VIEW grant for a return target', () => {
    const permission = (permissionCode: string, effect: 'ALLOW' | 'DENY' = 'ALLOW') => ({
      resourceType: 'APP',
      resourceKey: 'APP.WORK',
      permissionCode,
      effect,
    });
    const target = '/work/queue?scope=mine';

    expect(authorizedCalendarWorkReturnTarget(target, [permission('VIEW')])).toBe(target);
    expect(authorizedCalendarWorkReturnTarget(target, [])).toBeNull();
    expect(authorizedCalendarWorkReturnTarget(target, [permission('MANAGE')])).toBeNull();
    expect(
      authorizedCalendarWorkReturnTarget(target, [permission('VIEW'), permission('VIEW', 'DENY')])
    ).toBeNull();
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
