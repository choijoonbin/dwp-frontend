import { describe, expect, it } from 'vitest';

import {
  calendarCanChangeSelection,
  calendarCanManageSharing,
  calendarIsRequired,
  eventCapability,
  groupCalendarSources,
  normalizeCalendarSelection,
} from './calendar-source-model';

import type { CalendarEvent, CalendarSummary } from '@dwp-frontend/shared-utils';

function calendar(overrides: Partial<CalendarSummary> = {}): CalendarSummary {
  return {
    calendarId: 'calendar-1',
    calendarKey: 'calendar-1',
    name: 'Calendar',
    color: '#2563EB',
    type: 'PERSONAL',
    visibility: 'PRIVATE',
    selected: true,
    ...overrides,
  };
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    eventId: 'event-1',
    calendarId: 'calendar-1',
    calendarName: 'Calendar',
    calendarColor: '#2563EB',
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
    responseRequired: false,
    attendees: [],
    conflict: false,
    version: 1,
    ...overrides,
  };
}

describe('calendar source model', () => {
  it('groups each source once with favorites first and stable enterprise sections', () => {
    const groups = groupCalendarSources([
      calendar({ calendarId: 'company', sourceKind: 'COMPANY', type: 'SYSTEM' }),
      calendar({ calendarId: 'mine', sourceKind: 'OWNED' }),
      calendar({ calendarId: 'shared', sourceKind: 'SHARED' }),
      calendar({ calendarId: 'team', sourceKind: 'TEAM', type: 'TEAM' }),
      calendar({ calendarId: 'favorite', sourceKind: 'SHARED', favorite: true }),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      'favorites',
      'company',
      'mine',
      'shared',
      'team',
    ]);
    expect(groups.flatMap((group) => group.calendars.map((item) => item.calendarId))).toEqual([
      'favorite',
      'company',
      'mine',
      'shared',
      'team',
    ]);
  });

  it('forces REQUIRED calendars into every selection and blocks deselection', () => {
    const company = calendar({
      calendarId: 'company',
      sourceKind: 'COMPANY',
      selected: false,
      subscriptionPolicy: 'REQUIRED',
    });
    const mine = calendar({ calendarId: 'mine', selected: false });

    expect(calendarIsRequired(company)).toBe(true);
    expect(normalizeCalendarSelection([company, mine], [])).toEqual(['company']);
    expect(calendarCanChangeSelection(company, false)).toBe(false);
    expect(calendarCanChangeSelection(mine, true)).toBe(true);
  });

  it('uses server capabilities as the authority for sharing and event actions', () => {
    expect(
      calendarCanManageSharing(
        calendar({
          sourceKind: 'OWNED',
          accessLevel: 'OWNER',
          capabilities: {
            canViewDetails: true,
            canCreateEvents: true,
            canEditCalendar: true,
            canManageSharing: false,
            canDeleteCalendar: false,
            canUnsubscribe: true,
          },
        })
      )
    ).toBe(false);
    expect(
      calendarCanManageSharing(
        calendar({
          sourceKind: 'SHARED',
          accessLevel: 'MANAGE',
          capabilities: {
            canViewDetails: true,
            canCreateEvents: true,
            canEditCalendar: true,
            canManageSharing: true,
            canDeleteCalendar: false,
            canUnsubscribe: true,
          },
        })
      )
    ).toBe(true);

    expect(
      eventCapability(
        event({
          capabilities: {
            canViewDetails: true,
            canEdit: false,
            canDelete: false,
            canRestore: false,
            canRespond: true,
            canStar: true,
          },
        }),
        'canEdit',
        true
      )
    ).toBe(false);
  });
});
