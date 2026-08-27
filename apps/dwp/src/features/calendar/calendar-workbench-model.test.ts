import { describe, expect, it } from 'vitest';

import {
  calendarEventMinutes,
  calendarHorizon,
  calendarInvitations,
  calendarPlanningEvents,
  countCalendarInvitationResponses,
  filterCalendarInvitations,
} from './calendar-workbench-model';

import type { CalendarEvent } from '@dwp-frontend/shared-utils';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    eventId: 'event-1',
    calendarId: 'calendar-1',
    calendarName: 'My calendar',
    calendarColor: '#2563EB',
    organizerUserId: 2,
    organizerName: 'Minseo Kim',
    title: 'Planning review',
    type: 'MEETING',
    startsAt: '2026-08-27T01:00:00Z',
    endsAt: '2026-08-27T02:00:00Z',
    timeZone: 'Asia/Seoul',
    allDay: false,
    status: 'CONFIRMED',
    visibility: 'DEFAULT',
    recurrence: 'NONE',
    recurrenceInterval: 1,
    responseRequired: true,
    myResponse: 'NEEDS_ACTION',
    attendees: [],
    conflict: false,
    version: 1,
    ...overrides,
  };
}

describe('calendar workbench model', () => {
  it('creates a stable local-day horizon and calculates event duration', () => {
    const now = new Date(2026, 7, 26, 15, 30);
    const expectedFrom = new Date(2026, 7, 25, 0, 0).toISOString();
    const expectedTo = new Date(2026, 8, 9, 0, 0).toISOString();
    const range = calendarHorizon(now, 1, 14);

    expect(range.from).toBe(expectedFrom);
    expect(range.to).toBe(expectedTo);
    expect(calendarEventMinutes(event())).toBe(60);
  });

  it('separates upcoming focus and task blocks while excluding cancelled and elapsed work', () => {
    const result = calendarPlanningEvents(
      [
        event({ eventId: 'focus', type: 'FOCUS' }),
        event({ eventId: 'task', type: 'TASK', startsAt: '2026-08-28T01:00:00Z' }),
        event({ eventId: 'cancelled', type: 'FOCUS', status: 'CANCELLED' }),
        event({
          eventId: 'past',
          type: 'TASK',
          startsAt: '2026-08-20T01:00:00Z',
          endsAt: '2026-08-20T02:00:00Z',
        }),
      ],
      new Date('2026-08-26T00:00:00Z')
    );

    expect(result.focus.map((item) => item.eventId)).toEqual(['focus']);
    expect(result.tasks.map((item) => item.eventId)).toEqual(['task']);
  });

  it('builds an invitation inbox and response counts from actionable attendee events', () => {
    const events = [
      event({ eventId: 'pending' }),
      event({ eventId: 'accepted', myResponse: 'ACCEPTED' }),
      event({ eventId: 'owned', responseRequired: false, myResponse: null }),
      event({ eventId: 'cancelled', status: 'CANCELLED' }),
    ];

    expect(calendarInvitations(events).map((item) => item.eventId)).toEqual([
      'pending',
      'accepted',
    ]);
    const now = new Date('2026-08-26T00:00:00Z');
    expect(filterCalendarInvitations(events, 'ACCEPTED', now).map((item) => item.eventId)).toEqual([
      'accepted',
    ]);
    expect(countCalendarInvitationResponses(events, now)).toEqual({
      NEEDS_ACTION: 1,
      ACCEPTED: 1,
      TENTATIVE: 0,
      DECLINED: 0,
    });
  });

  it('keeps elapsed invitations in history without presenting them as pending decisions', () => {
    const elapsed = event({
      eventId: 'elapsed-pending',
      startsAt: '2026-08-20T01:00:00Z',
      endsAt: '2026-08-20T02:00:00Z',
    });
    const now = new Date('2026-08-26T00:00:00Z');

    expect(filterCalendarInvitations([elapsed], 'ALL', now)).toEqual([elapsed]);
    expect(filterCalendarInvitations([elapsed], 'NEEDS_ACTION', now)).toEqual([]);
    expect(countCalendarInvitationResponses([elapsed], now).NEEDS_ACTION).toBe(0);
  });
});
