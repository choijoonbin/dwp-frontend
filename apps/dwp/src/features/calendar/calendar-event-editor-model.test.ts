import { describe, expect, it } from 'vitest';

import {
  calendarEditorAttendees,
  calendarEventDraft,
  calendarEventInput,
} from './calendar-event-editor-model';

import type { CalendarEvent } from '@dwp-frontend/shared-utils';

const EVENT: CalendarEvent = {
  eventId: 'event-1',
  calendarId: 'calendar-1',
  calendarName: 'My calendar',
  calendarColor: '#2563EB',
  organizerUserId: 1,
  organizerName: 'Minseo Kim',
  title: 'Global release day',
  description: 'Coordinate the release.',
  type: 'MEETING',
  startsAt: '2026-11-01T05:30:00Z',
  endsAt: '2026-11-02T05:30:00Z',
  timeZone: 'America/New_York',
  allDay: true,
  status: 'CONFIRMED',
  visibility: 'CONFIDENTIAL',
  recurrence: 'WEEKLY',
  recurrenceInterval: 2,
  recurrenceUntil: '2027-01-31',
  responseRequired: true,
  attendees: [
    {
      userId: 2,
      personPublicId: '00ba0853-02a8-7499-b6d8-009251e6a464',
      email: 'optional@example.com',
      name: 'Optional attendee',
      type: 'OPTIONAL',
      response: 'TENTATIVE',
    },
  ],
  conflict: false,
  version: 7,
};

describe('calendar event editor model', () => {
  it('round-trips timezone, all-day, recurrence interval, and attendee type without loss', () => {
    const draft = calendarEventDraft(EVENT, { fallbackTimeZone: 'Asia/Seoul' });
    const attendees = calendarEditorAttendees(EVENT, [], []);
    const input = calendarEventInput({ ...draft, title: 'Global release day updated' }, attendees);

    expect(input).toMatchObject({
      title: 'Global release day updated',
      timeZone: 'America/New_York',
      allDay: true,
      recurrence: 'WEEKLY',
      recurrenceInterval: 2,
      recurrenceUntil: '2027-01-31',
    });
    expect(input.attendees).toEqual([
      expect.objectContaining({
        personPublicId: '00ba0853-02a8-7499-b6d8-009251e6a464',
        type: 'OPTIONAL',
      }),
    ]);
  });

  it('marks handoff attendees as required while keeping external email identities out of free-busy IDs', () => {
    const attendees = calendarEditorAttendees(
      undefined,
      [
        {
          personId: '00ba0853-02a8-7499-b6d8-009251e6a464',
          displayName: 'Internal person',
          workEmail: 'internal@example.com',
          lifecycleState: 'ACTIVE',
          organizationName: 'DWP',
          directReportCount: 0,
          dataAccess: {
            classification: 'DIRECTORY',
            workerNumberMasked: true,
            excludedFieldGroups: [],
          },
        },
      ],
      ['guest@example.com']
    );
    const draft = calendarEventDraft(null, {
      initialStart: '2026-08-27T01:00:00Z',
      initialEnd: '2026-08-27T02:00:00Z',
      fallbackTimeZone: 'Asia/Seoul',
    });

    expect(attendees.map((attendee) => attendee.type)).toEqual(['REQUIRED', 'REQUIRED']);
    expect(draft.timeZone).toBe('Asia/Seoul');
    expect(calendarEventInput(draft, attendees).attendees[1]?.personPublicId).toBeNull();
  });

  it.each(['FOCUS', 'TASK', 'OUT_OF_OFFICE'] as const)(
    'removes meeting-only participants and room metadata from %s payloads',
    (type) => {
      const draft = {
        ...calendarEventDraft(EVENT, { fallbackTimeZone: 'Asia/Seoul' }),
        type,
        resourceId: 'room-1',
        location: 'Seoul HQ',
        conferenceUrl: 'https://meet.example.invalid/event',
        responseRequired: true,
      };
      const input = calendarEventInput(draft, calendarEditorAttendees(EVENT, [], []));

      expect(input).toMatchObject({
        type,
        resourceId: null,
        location: null,
        conferenceUrl: null,
        responseRequired: false,
        attendees: [],
      });
    }
  );
});
