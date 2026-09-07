import { describe, expect, it } from 'vitest';

import {
  calendarConferenceUrl,
  calendarEventCanJoin,
  calendarGreetingPeriod,
  calendarHomeSnapshotIsFresh,
  calendarMinutesUntil,
  calendarTodayHasCurrentEvent,
  calendarTodayLeadEvent,
  calendarTodayMetrics,
  calendarTodayStream,
  calendarWorkdayPhase,
} from './calendar-today-model';

import type { CalendarEvent } from '@dwp-frontend/shared-utils';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    eventId: 'event-1',
    calendarId: 'calendar-1',
    calendarName: 'My calendar',
    calendarColor: '#2764C4',
    organizerUserId: 1,
    organizerName: 'Member',
    organizerEmail: 'member@example.invalid',
    title: 'Planning review',
    description: null,
    type: 'MEETING',
    startsAt: '2026-08-11T01:00:00Z',
    endsAt: '2026-08-11T01:45:00Z',
    timeZone: 'Asia/Seoul',
    allDay: false,
    location: null,
    conferenceUrl: null,
    status: 'CONFIRMED',
    visibility: 'DEFAULT',
    recurrence: 'NONE',
    recurrenceInterval: 1,
    recurrenceUntil: null,
    responseRequired: false,
    myResponse: null,
    attendees: [],
    resource: null,
    conflict: false,
    importance: 'NORMAL',
    detailLevel: 'FULL',
    redacted: false,
    starred: false,
    preferenceVersion: 0,
    capabilities: {
      canViewDetails: true,
      canEdit: true,
      canDelete: true,
      canRestore: false,
      canRespond: false,
      canStar: true,
    },
    restrictionReason: null,
    version: 1,
    ...overrides,
  };
}

describe('calendar today model', () => {
  it('uses the server snapshot to separate open windows and event phases', () => {
    const stream = calendarTodayStream(
      [
        event({
          eventId: 'elapsed',
          startsAt: '2026-08-11T00:00:00Z',
          endsAt: '2026-08-11T00:15:00Z',
        }),
        event({ eventId: 'next' }),
        event({
          eventId: 'focus',
          type: 'FOCUS',
          startsAt: '2026-08-11T05:00:00Z',
          endsAt: '2026-08-11T06:30:00Z',
        }),
      ],
      '2026-08-11T00:20:00Z'
    );

    expect(stream.map((item) => item.kind)).toEqual([
      'event',
      'open-window',
      'event',
      'open-window',
      'event',
    ]);
    expect(stream[0]).toMatchObject({ kind: 'event', phase: 'ELAPSED' });
    expect(stream[1]).toMatchObject({ kind: 'open-window', durationMinutes: 40 });
    expect(stream[3]).toMatchObject({ kind: 'open-window', durationMinutes: 195 });
  });

  it('does not invent availability inside overlaps or below the minimum duration', () => {
    const stream = calendarTodayStream(
      [
        event({ endsAt: '2026-08-11T02:00:00Z' }),
        event({
          eventId: 'overlap',
          startsAt: '2026-08-11T01:30:00Z',
          endsAt: '2026-08-11T02:30:00Z',
        }),
        event({
          eventId: 'nearby',
          startsAt: '2026-08-11T02:50:00Z',
          endsAt: '2026-08-11T03:10:00Z',
        }),
      ],
      '2026-08-11T00:50:00Z'
    );

    expect(stream.filter((item) => item.kind === 'open-window')).toHaveLength(0);
  });

  it('excludes cancelled events from the actionable day', () => {
    const active = event();
    const events = [event({ eventId: 'cancelled', status: 'CANCELLED' }), active];

    expect(calendarTodayLeadEvent(events, '2026-08-11T00:20:00Z')).toEqual(active);
    expect(
      calendarTodayStream(events, '2026-08-11T00:20:00Z').filter((item) => item.kind === 'event')
    ).toHaveLength(1);
  });

  it('derives relative time and greeting from the server clock and calendar timezone', () => {
    const next = event();
    expect(calendarMinutesUntil(next, '2026-08-11T00:20:00Z')).toBe(40);
    expect(calendarGreetingPeriod('2026-08-11T00:20:00Z', 'Asia/Seoul')).toBe('morning');
    expect(calendarGreetingPeriod('2026-08-11T10:20:00Z', 'Asia/Seoul')).toBe('evening');
  });

  it('offers a meeting join action only shortly before or during the event', () => {
    const meeting = event({ conferenceUrl: 'https://meet.example.invalid/room' });

    expect(calendarEventCanJoin(meeting, '2026-08-11T00:49:59Z')).toBe(false);
    expect(calendarEventCanJoin(meeting, '2026-08-11T00:50:00Z')).toBe(true);
    expect(calendarEventCanJoin(meeting, '2026-08-11T01:20:00Z')).toBe(true);
    expect(calendarEventCanJoin(meeting, '2026-08-11T01:45:00Z')).toBe(false);
    expect(calendarEventCanJoin({ ...meeting, status: 'CANCELLED' }, '2026-08-11T01:20:00Z')).toBe(
      false
    );
  });

  it('keeps the day active while a valid after-hours event is actually in progress', () => {
    const afterHours = event({
      startsAt: '2026-09-03T10:30:00Z',
      endsAt: '2026-09-03T11:30:00Z',
    });

    expect(calendarTodayHasCurrentEvent([afterHours], '2026-09-03T10:29:59Z')).toBe(false);
    expect(calendarTodayHasCurrentEvent([afterHours], '2026-09-03T11:00:00Z')).toBe(true);
    expect(calendarTodayHasCurrentEvent([afterHours], '2026-09-03T11:30:00Z')).toBe(false);
    expect(
      calendarTodayHasCurrentEvent([{ ...afterHours, status: 'CANCELLED' }], '2026-09-03T11:00:00Z')
    ).toBe(false);
  });

  it('never exposes unsafe or redacted conference links for copy or join', () => {
    for (const conferenceUrl of [
      'javascript:alert(1)',
      'data:text/html,test',
      'not-a-url',
      'https://user:secret@example.com',
    ]) {
      expect(calendarConferenceUrl(event({ conferenceUrl }))).toBeNull();
      expect(calendarEventCanJoin(event({ conferenceUrl }), '2026-08-11T01:20:00Z')).toBe(false);
    }
    expect(
      calendarConferenceUrl(event({ conferenceUrl: 'https://meet.example/room', redacted: true }))
    ).toBeNull();
    expect(
      calendarConferenceUrl(
        event({ conferenceUrl: 'https://meet.example/room', detailLevel: 'FREE_BUSY' })
      )
    ).toBeNull();
    expect(calendarConferenceUrl(event({ conferenceUrl: 'https://meet.example/room' }))).toBe(
      'https://meet.example/room'
    );
  });

  it('derives today metrics from visible events instead of the weekly summary', () => {
    const metrics = calendarTodayMetrics(
      [
        event(),
        event({
          eventId: 'focus',
          type: 'FOCUS',
          startsAt: '2026-08-11T05:00:00Z',
          endsAt: '2026-08-11T06:30:00Z',
        }),
        event({ eventId: 'cancelled', status: 'CANCELLED' }),
      ],
      '2026-08-11',
      'Asia/Seoul'
    );

    expect(metrics).toEqual({ eventCount: 2, meetingMinutes: 45, focusMinutes: 90 });
  });

  it('counts elapsed minutes across a daylight-saving transition without wall-clock drift', () => {
    expect(
      calendarTodayMetrics(
        [
          event({
            startsAt: '2026-11-01T05:30:00Z',
            endsAt: '2026-11-01T07:30:00Z',
            timeZone: 'America/New_York',
          }),
        ],
        '2026-11-01',
        'America/New_York'
      )
    ).toEqual({ eventCount: 1, meetingMinutes: 120, focusMinutes: 0 });
  });

  it('adds a policy-bounded final focus window without extending beyond work hours', () => {
    const stream = calendarTodayStream(
      [
        event(),
        event({
          eventId: 'focus',
          type: 'FOCUS',
          startsAt: '2026-08-11T05:00:00Z',
          endsAt: '2026-08-11T06:30:00Z',
        }),
      ],
      '2026-08-11T00:20:00Z',
      {
        date: '2026-08-11',
        timeZone: 'Asia/Seoul',
        workingDayStart: '09:00',
        workingDayEnd: '18:00',
      }
    );
    const openWindows = stream.filter((item) => item.kind === 'open-window');

    expect(openWindows.map((item) => item.durationMinutes)).toEqual([40, 195, 150]);
    expect(openWindows.at(-1)).toMatchObject({ endsAt: '2026-08-11T09:00:00.000Z' });
  });

  it('derives the workday phase only from validated timezone and policy evidence', () => {
    const options = {
      date: '2026-09-03',
      timeZone: 'Asia/Seoul',
      workingDayStart: '09:00',
      workingDayEnd: '18:00',
    };

    expect(calendarWorkdayPhase('2026-09-02T23:30:00Z', options)).toBe('BEFORE');
    expect(calendarWorkdayPhase('2026-09-03T05:00:00Z', options)).toBe('ACTIVE');
    expect(calendarWorkdayPhase('2026-09-03T09:51:00Z', options)).toBe('AFTER');
    expect(calendarWorkdayPhase('2026-09-03T09:51:00Z', { ...options, workingDayEnd: null })).toBe(
      'UNKNOWN'
    );
    expect(
      calendarWorkdayPhase('2026-09-03T09:51:00Z', {
        ...options,
        workingDayStart: '18:00',
        workingDayEnd: '09:00',
      })
    ).toBe('UNKNOWN');
  });

  it('expires old successful snapshots and rejects malformed or future clock evidence', () => {
    expect(calendarHomeSnapshotIsFresh('2026-08-11T00:20:00Z', '2026-08-11T00:21:59Z')).toBe(true);
    expect(calendarHomeSnapshotIsFresh('2026-08-11T00:20:00Z', '2026-08-11T00:22:01Z')).toBe(false);
    expect(calendarHomeSnapshotIsFresh('not-a-date', '2026-08-11T00:20:00Z')).toBe(false);
    expect(calendarHomeSnapshotIsFresh('2026-08-11T00:22:00Z', '2026-08-11T00:20:00Z')).toBe(false);
  });
});
