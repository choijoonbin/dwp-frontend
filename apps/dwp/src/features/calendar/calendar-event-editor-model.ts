import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';

import type {
  CalendarAttendeeInput,
  CalendarAttendeeType,
  CalendarEvent,
  CalendarEventImportance,
  CalendarEventType,
  CalendarRecurrence,
  CalendarVisibility,
  CreateCalendarEventInput,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

export type CalendarEventDraft = {
  title: string;
  description: string;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string;
  conferenceUrl: string;
  visibility: CalendarVisibility;
  importance: CalendarEventImportance;
  recurrence: CalendarRecurrence;
  recurrenceInterval: number;
  recurrenceUntil: string;
  responseRequired: boolean;
  resourceId: string;
  timeZone: string;
  calendarId: string;
};

export type CalendarEditorAttendee = Pick<
  PersonSummary,
  'personId' | 'displayName' | 'workEmail'
> & {
  userId?: number | null;
  type: Exclude<CalendarAttendeeType, 'RESOURCE'>;
};

export function calendarSystemTimeZone() {
  return resolveSystemTimeZone('Asia/Seoul');
}

function roundToHalfHour(value = new Date()) {
  const next = new Date(value);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  next.setMinutes(minutes < 30 ? 30 : 60);
  return next;
}

export function calendarEventDraft(
  event?: CalendarEvent | null,
  options: Readonly<{
    initialStart?: string | null;
    initialEnd?: string | null;
    initialType?: CalendarEventType;
    initialTitle?: string | null;
    initialResourceId?: string | null;
    initialCalendarId?: string | null;
    fallbackTimeZone?: string;
  }> = {}
): CalendarEventDraft {
  const initialType = options.initialType ?? 'MEETING';
  const start = options.initialStart ? new Date(options.initialStart) : roundToHalfHour();
  const end = options.initialEnd
    ? new Date(options.initialEnd)
    : new Date(start.getTime() + (initialType === 'FOCUS' ? 90 : 30) * 60_000);
  return {
    title: event?.title ?? options.initialTitle ?? '',
    description: event?.description ?? '',
    type: event?.type ?? initialType,
    startsAt: event?.startsAt ?? start.toISOString(),
    endsAt: event?.endsAt ?? end.toISOString(),
    allDay: event?.allDay ?? false,
    location: event?.location ?? '',
    conferenceUrl: event?.conferenceUrl ?? '',
    visibility: event?.visibility ?? 'DEFAULT',
    importance: event?.importance ?? 'NORMAL',
    recurrence: event?.recurrence ?? 'NONE',
    recurrenceInterval: event?.recurrenceInterval ?? 1,
    recurrenceUntil: event?.recurrenceUntil ?? '',
    responseRequired: event?.responseRequired ?? true,
    resourceId: event?.resource?.resourceId ?? options.initialResourceId ?? '',
    timeZone: event?.timeZone ?? options.fallbackTimeZone ?? calendarSystemTimeZone(),
    calendarId: event?.calendarId ?? options.initialCalendarId ?? '',
  };
}

export function calendarEditorAttendees(
  event: CalendarEvent | null | undefined,
  initialAttendees: readonly PersonSummary[],
  initialAttendeeEmails: readonly string[]
): CalendarEditorAttendee[] {
  if (event) {
    return event.attendees.map((attendee) => ({
      personId:
        attendee.personPublicId ??
        (attendee.userId ? `user:${attendee.userId}` : `email:${attendee.email}`),
      displayName: attendee.name,
      workEmail: attendee.email,
      userId: attendee.userId,
      type: attendee.type === 'OPTIONAL' ? 'OPTIONAL' : 'REQUIRED',
    }));
  }
  return [
    ...initialAttendees.map((attendee) => ({ ...attendee, type: 'REQUIRED' as const })),
    ...initialAttendeeEmails.map((email) => ({
      personId: `email:${email}`,
      displayName: email,
      workEmail: email,
      type: 'REQUIRED' as const,
    })),
  ];
}

function attendeeInput(attendees: readonly CalendarEditorAttendee[]): CalendarAttendeeInput[] {
  return attendees
    .filter((person) => person.workEmail)
    .map((person) => ({
      userId: person.userId,
      personPublicId:
        person.personId.startsWith('user:') || person.personId.startsWith('email:')
          ? null
          : person.personId,
      email: person.workEmail!,
      name: person.displayName,
      type: person.type,
    }));
}

export function calendarEventInput(
  draft: CalendarEventDraft,
  attendees: readonly CalendarEditorAttendee[]
): Omit<CreateCalendarEventInput, 'idempotencyKey'> {
  const meeting = draft.type === 'MEETING';
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    type: draft.type,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    timeZone: draft.timeZone,
    allDay: draft.allDay,
    location: meeting ? draft.location.trim() || null : null,
    conferenceUrl: meeting ? draft.conferenceUrl.trim() || null : null,
    visibility: draft.visibility,
    importance: draft.importance,
    recurrence: draft.recurrence,
    recurrenceInterval: draft.recurrenceInterval,
    recurrenceUntil: draft.recurrence === 'NONE' ? null : draft.recurrenceUntil || null,
    responseRequired: meeting && draft.responseRequired,
    attendees: meeting ? attendeeInput(attendees) : [],
    resourceId: meeting ? draft.resourceId || null : null,
    calendarId: draft.calendarId || null,
  };
}
