import {
  resolveSystemTimeZone,
  resolveZonedClock,
  resolveZonedDateKey,
} from '@dwp-frontend/shared-i18n';
import {
  workCalendarEventHandoffDescription,
  type WorkCalendarEventHandoff,
} from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';

import {
  calendarDedupedAttendees,
  calendarExternalAttendee,
} from './calendar-attendee-picker-model';
import type { CalendarEditorAttendee as CalendarEditorAttendeeContract } from './calendar-attendee-contract';

import type {
  CalendarAttendeeInput,
  CalendarAttendeeType,
  CalendarDayOfWeek,
  CalendarEvent,
  CalendarEventImportance,
  CalendarEventType,
  CalendarRecurrence,
  CalendarVisibility,
  CreateCalendarEventInput,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

export type CalendarRecurrenceEndMode = 'NEVER' | 'UNTIL' | 'COUNT';

export type CalendarRecurrenceDraftState = {
  startsAt: string;
  timeZone: string;
  recurrence: CalendarRecurrence;
  recurrenceInterval: number;
  recurrenceUntil: string;
  recurrenceDays: CalendarDayOfWeek[];
  recurrenceCount: number;
  recurrenceEndMode: CalendarRecurrenceEndMode;
};

export const CALENDAR_RECURRENCE_DAYS: readonly CalendarDayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const DAY_BY_NUMBER: Readonly<Record<number, CalendarDayOfWeek>> = {
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
  7: 'SUNDAY',
};

export type CalendarEventDraft = CalendarRecurrenceDraftState & {
  title: string;
  description: string;
  type: CalendarEventType;
  endsAt: string;
  allDay: boolean;
  location: string;
  conferenceUrl: string;
  visibility: CalendarVisibility;
  importance: CalendarEventImportance;
  responseRequired: boolean;
  resourceId: string;
  calendarId: string;
};

export const EMPTY_CALENDAR_EDITOR_PEOPLE: PersonSummary[] = [];
export const EMPTY_CALENDAR_EDITOR_EMAILS: string[] = [];
export const CALENDAR_EDITOR_COMMON_TIME_ZONES = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'UTC',
] as const;

export function protectWorkCalendarEventDraft(
  draft: CalendarEventDraft,
  description: string
): CalendarEventDraft {
  return {
    ...draft,
    description,
    type: 'FOCUS',
    allDay: false,
    location: '',
    conferenceUrl: '',
    visibility: 'PRIVATE',
    recurrence: 'NONE',
    recurrenceInterval: 1,
    recurrenceUntil: '',
    recurrenceDays: [],
    recurrenceCount: 10,
    recurrenceEndMode: 'NEVER',
    responseRequired: false,
    resourceId: '',
  };
}

export type CalendarEditorAttendee = CalendarEditorAttendeeContract;

export type CalendarInitialAttendee = Pick<
  PersonSummary,
  'personId' | 'displayName' | 'workEmail'
> &
  Partial<PersonSummary> & {
    userId?: number | null;
    type?: Exclude<CalendarAttendeeType, 'RESOURCE'>;
  };

export function calendarSystemTimeZone() {
  return resolveSystemTimeZone('Asia/Seoul');
}

export function calendarRecurrenceAnchorDay(startsAt: string, timeZone: string): CalendarDayOfWeek {
  const day = resolveZonedClock(startsAt, timeZone)?.day;
  if (day && DAY_BY_NUMBER[day]) return DAY_BY_NUMBER[day];
  const fallback = new Date(startsAt).getUTCDay();
  return DAY_BY_NUMBER[fallback === 0 ? 7 : fallback] ?? 'MONDAY';
}

function sortedRecurrenceDays(days: readonly CalendarDayOfWeek[]) {
  return CALENDAR_RECURRENCE_DAYS.filter((day) => days.includes(day));
}

export function calendarRecurrenceDaysForStart(
  days: readonly CalendarDayOfWeek[],
  startsAt: string,
  timeZone: string
): CalendarDayOfWeek[] {
  return sortedRecurrenceDays([...days, calendarRecurrenceAnchorDay(startsAt, timeZone)]);
}

export function calendarRecurrenceUntilIsValid(state: CalendarRecurrenceDraftState): boolean {
  if (state.recurrence === 'NONE' || state.recurrenceEndMode !== 'UNTIL') return true;
  const localStart = resolveZonedDateKey(state.startsAt, state.timeZone);
  return Boolean(
    localStart &&
    /^\d{4}-\d{2}-\d{2}$/u.test(state.recurrenceUntil) &&
    state.recurrenceUntil >= localStart
  );
}

export function patchCalendarEventDraft<T extends CalendarRecurrenceDraftState>(
  current: T,
  patch: Partial<T>
): T {
  const next = { ...current, ...patch } as T;
  if (next.recurrence === 'NONE') {
    return {
      ...next,
      recurrenceDays: [],
      recurrenceEndMode: 'NEVER',
      recurrenceUntil: '',
    } as T;
  }
  if (next.recurrence !== 'WEEKLY') {
    next.recurrenceDays = [];
  } else {
    const previousAnchor = calendarRecurrenceAnchorDay(current.startsAt, current.timeZone);
    const nextAnchor = calendarRecurrenceAnchorDay(next.startsAt, next.timeZone);
    const currentDays = sortedRecurrenceDays(next.recurrenceDays);
    const adjustedDays =
      (patch.startsAt !== undefined || patch.timeZone !== undefined) &&
      currentDays.length === 1 &&
      currentDays[0] === previousAnchor
        ? [nextAnchor]
        : currentDays;
    next.recurrenceDays = calendarRecurrenceDaysForStart(
      adjustedDays,
      next.startsAt,
      next.timeZone
    );
  }
  if (next.recurrenceEndMode !== 'UNTIL') next.recurrenceUntil = '';
  return next;
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
    initialDescription?: string | null;
    initialVisibility?: CalendarVisibility;
    initialResourceId?: string | null;
    initialCalendarId?: string | null;
    fallbackTimeZone?: string;
    initialImportance?: CalendarEventImportance;
  }> = {}
): CalendarEventDraft {
  const initialType = options.initialType ?? 'MEETING';
  const start = options.initialStart ? new Date(options.initialStart) : roundToHalfHour();
  const end = options.initialEnd
    ? new Date(options.initialEnd)
    : new Date(start.getTime() + (initialType === 'FOCUS' ? 90 : 30) * 60_000);
  const draft: CalendarEventDraft = {
    title: event?.title ?? options.initialTitle ?? '',
    description: event?.description ?? options.initialDescription ?? '',
    type: event?.type ?? initialType,
    startsAt: event?.startsAt ?? start.toISOString(),
    endsAt: event?.endsAt ?? end.toISOString(),
    allDay: event?.allDay ?? false,
    location: event?.location ?? '',
    conferenceUrl: event?.conferenceUrl ?? '',
    visibility: event?.visibility ?? options.initialVisibility ?? 'DEFAULT',
    importance: event?.importance ?? options.initialImportance ?? 'NORMAL',
    recurrence: event?.recurrence ?? 'NONE',
    recurrenceInterval: event?.recurrenceInterval ?? 1,
    recurrenceUntil: event?.recurrenceUntil ?? '',
    recurrenceDays: event?.recurrenceDays ?? [],
    recurrenceCount: event?.recurrenceCount ?? 10,
    recurrenceEndMode: event?.recurrenceCount
      ? 'COUNT'
      : event?.recurrenceUntil
        ? 'UNTIL'
        : 'NEVER',
    responseRequired: event?.responseRequired ?? true,
    resourceId: event?.resource?.resourceId ?? options.initialResourceId ?? '',
    timeZone: event?.timeZone ?? options.fallbackTimeZone ?? calendarSystemTimeZone(),
    calendarId: event?.calendarId ?? options.initialCalendarId ?? '',
  };
  return patchCalendarEventDraft(draft, {});
}

export function calendarEditorAttendees(
  event: CalendarEvent | null | undefined,
  initialAttendees: readonly CalendarInitialAttendee[],
  initialAttendeeEmails: readonly string[]
): CalendarEditorAttendee[] {
  if (event) {
    return calendarDedupedAttendees(
      event.attendees.map((attendee) => ({
        personId:
          attendee.personPublicId ??
          (attendee.userId ? `user:${attendee.userId}` : `email:${attendee.email}`),
        displayName: attendee.name,
        workEmail: attendee.email,
        userId: attendee.userId,
        type: attendee.type === 'OPTIONAL' ? 'OPTIONAL' : 'REQUIRED',
      }))
    );
  }
  return calendarDedupedAttendees([
    ...initialAttendees.map((attendee) => ({
      ...attendee,
      type: attendee.type ?? ('REQUIRED' as const),
    })),
    ...initialAttendeeEmails.flatMap((email) => {
      const attendee = calendarExternalAttendee(email, 'REQUIRED');
      return attendee ? [attendee] : [];
    }),
  ]);
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
  attendees: readonly CalendarEditorAttendee[],
  options: Readonly<{
    workReference?: Pick<WorkCalendarEventHandoff, 'work' | 'sourceUrl'> | null;
  }> = {}
): Omit<CreateCalendarEventInput, 'idempotencyKey'> {
  const workDescription = options.workReference
    ? workCalendarEventHandoffDescription(options.workReference)
    : null;
  const type = workDescription ? 'FOCUS' : draft.type;
  const meeting = type === 'MEETING';
  return {
    title: draft.title.trim(),
    description: workDescription ?? (draft.description.trim() || null),
    type,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    timeZone: draft.timeZone,
    allDay: workDescription ? false : draft.allDay,
    location: meeting ? draft.location.trim() || null : null,
    conferenceUrl: meeting ? draft.conferenceUrl.trim() || null : null,
    visibility: workDescription ? 'PRIVATE' : draft.visibility,
    importance: draft.importance,
    recurrence: workDescription ? 'NONE' : draft.recurrence,
    recurrenceInterval: workDescription ? 1 : draft.recurrenceInterval,
    recurrenceUntil:
      workDescription || draft.recurrence === 'NONE' || draft.recurrenceEndMode !== 'UNTIL'
        ? null
        : draft.recurrenceUntil || null,
    recurrenceDays:
      workDescription || draft.recurrence !== 'WEEKLY'
        ? []
        : calendarRecurrenceDaysForStart(draft.recurrenceDays, draft.startsAt, draft.timeZone),
    recurrenceCount:
      workDescription || draft.recurrence === 'NONE' || draft.recurrenceEndMode !== 'COUNT'
        ? null
        : draft.recurrenceCount,
    responseRequired: meeting && draft.responseRequired,
    attendees: meeting ? attendeeInput(attendees) : [],
    resourceId: meeting ? draft.resourceId || null : null,
    calendarId: draft.calendarId || null,
  };
}
