import type {
  CalendarEvent,
  UpdateCalendarEventInput,
} from '@dwp-frontend/shared-utils';

/** Preserves every editable field when a grid drag or resize changes only event timing. */
export function calendarScheduleMoveInput(
  event: CalendarEvent,
  change: Readonly<{ startsAt: string; endsAt: string; allDay: boolean }>
): UpdateCalendarEventInput {
  return {
    title: event.title,
    description: event.description ?? null,
    type: event.type,
    startsAt: change.startsAt,
    endsAt: change.endsAt,
    timeZone: event.timeZone,
    allDay: change.allDay,
    location: event.location ?? null,
    conferenceUrl: event.conferenceUrl ?? null,
    visibility: event.visibility,
    recurrence: event.recurrence,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceUntil: event.recurrenceUntil ?? null,
    responseRequired: event.responseRequired,
    attendees: event.attendees.map((attendee) => ({
      userId: attendee.userId ?? null,
      personPublicId: attendee.personPublicId ?? null,
      email: attendee.email,
      name: attendee.name,
      type: attendee.type,
    })),
    resourceId: event.resource?.resourceId ?? null,
    importance: event.importance ?? 'NORMAL',
    version: event.version,
  };
}
