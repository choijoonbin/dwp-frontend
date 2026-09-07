import {
  createCalendarEvent,
  getCalendarEvents,
  type CalendarEvent,
  type CalendarSummary,
  type CreateCalendarEventInput,
} from '@dwp-frontend/shared-utils/api/calendar-api';
import {
  getWorkCalendarLinks,
  putWorkCalendarLink,
  removeWorkCalendarLink,
  type WorkCalendarLink,
} from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import type { WorkSourceReference } from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { WorkHubItem } from './work-hub-contracts';
import { resolveZonedClock } from '@dwp-frontend/shared-i18n';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

export type WorkScheduleCommand = {
  linkId: string;
  work: WorkSourceReference;
  eventInput: CreateCalendarEventInput;
};
export type WorkScheduleResult =
  | {
      state: 'CALENDAR_UNCONFIRMED' | 'CALENDAR_REJECTED';
      command: WorkScheduleCommand;
      sourceChanged: false;
      reason: string;
      retryable: boolean;
    }
  | {
      state: 'LINK_PENDING';
      command: WorkScheduleCommand;
      event: CalendarEvent;
      sourceChanged: false;
      reason: string;
      retryable: boolean;
    }
  | {
      state: 'SCHEDULED' | 'LINK_REMOVED';
      command: WorkScheduleCommand;
      event: CalendarEvent;
      link: WorkCalendarLink;
      sourceChanged: false;
    };
const schedulingClients = {
  createCalendarEvent,
  getCalendarEvents,
  getWorkCalendarLinks,
  putWorkCalendarLink,
  removeWorkCalendarLink,
};

const dayMs = 24 * 60 * 60_000;

/** Keeps Calendar lookups within the server's 370-day range contract. */
export function workScheduleLookupRange(date: string) {
  const anchor = Date.parse(`${date}T12:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
    !Number.isFinite(anchor) ||
    new Date(anchor).toISOString().slice(0, 10) !== date
  ) {
    throw new Error('A valid calendar date is required.');
  }
  return {
    from: new Date(anchor - 180 * dayMs).toISOString(),
    to: new Date(anchor + 180 * dayMs).toISOString(),
  };
}

function failure(error: unknown) {
  if (error instanceof HttpError) {
    if ([401, 403, 404].includes(error.status)) return { reason: 'FORBIDDEN', retryable: false };
    if (error.status === 409) return { reason: 'CONFLICT', retryable: false };
    if ([400, 422].includes(error.status)) return { reason: 'INVALID', retryable: false };
  }
  return { reason: 'UNAVAILABLE', retryable: true };
}

/** One user-reviewed command retains both identifiers across retries. */
export function prepareWorkSchedule(
  item: WorkHubItem,
  calendar: CalendarSummary,
  input: {
    startsAt: string;
    endsAt: string;
    timeZone: string;
    title: string;
  },
  linkId = crypto.randomUUID()
): WorkScheduleCommand {
  if (calendar.type !== 'PERSONAL' || !calendar.capabilities?.canCreateEvents)
    throw new Error('Choose an editable personal calendar.');
  if (['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(item.lifecycle))
    throw new Error('This work is no longer active.');
  const from = Date.parse(input.startsAt),
    to = Date.parse(input.endsAt);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from)
    throw new Error('Choose a valid work time range.');
  if (!resolveZonedClock(from, input.timeZone)) throw new Error('Choose a valid time zone.');
  const title = input.title.trim();
  if (!title || title.length > 300)
    throw new Error('A Calendar title of up to 300 characters is required.');
  return {
    linkId,
    work: { ...item.reference },
    eventInput: {
      title,
      type: 'FOCUS',
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timeZone: input.timeZone,
      allDay: false,
      visibility: 'PRIVATE',
      recurrence: 'NONE',
      recurrenceInterval: 1,
      responseRequired: false,
      attendees: [],
      calendarId: calendar.calendarId,
      idempotencyKey: linkId,
    },
  };
}

/** Never rolls back a confirmed Calendar event when the personal reference save fails. */
export async function executeWorkSchedule(
  command: WorkScheduleCommand,
  confirmedEvent?: CalendarEvent,
  clients = schedulingClients
): Promise<WorkScheduleResult> {
  let event = confirmedEvent;
  if (!event) {
    try {
      event = await clients.createCalendarEvent(command.eventInput);
    } catch (error) {
      const problem = failure(error);
      return {
        state: problem.retryable ? 'CALENDAR_UNCONFIRMED' : 'CALENDAR_REJECTED',
        command,
        sourceChanged: false,
        ...problem,
      };
    }
  }
  if (event.calendarId !== command.eventInput.calendarId || event.type !== 'FOCUS')
    throw new Error('The Calendar receipt does not match the reviewed command.');
  try {
    const link = await clients.putWorkCalendarLink(command.linkId, {
      work: command.work,
      eventId: event.eventId,
    });
    return {
      state: link.state === 'LINKED' ? 'SCHEDULED' : 'LINK_REMOVED',
      command,
      event,
      link,
      sourceChanged: false,
    };
  } catch (error) {
    return { state: 'LINK_PENDING', command, event, sourceChanged: false, ...failure(error) };
  }
}

export async function loadWorkSchedules(from: string, to: string, clients = schedulingClients) {
  const [linksResult, eventsResult] = await Promise.allSettled([
    (async () => {
      const items: WorkCalendarLink[] = [];
      for (let page = 0; page <= 10_000; page++) {
        const result = await clients.getWorkCalendarLinks(page, 100);
        items.push(...result.items);
        if (!result.hasMore) return items;
      }
      throw new Error('Calendar link pagination exceeded its supported range.');
    })(),
    clients.getCalendarEvents(from, to),
  ]);
  if (linksResult.status === 'rejected') return { state: 'UNAVAILABLE' as const, items: [] };
  const items = linksResult.value.map((link) => {
    if (eventsResult.status === 'rejected')
      return { link, state: 'UNAVAILABLE' as const, event: null };
    const event = eventsResult.value.find((candidate) => candidate.eventId === link.eventId);
    // A missing result can mean a different time range or revoked access; it never proves deletion.
    if (
      !event ||
      event.detailLevel === 'FREE_BUSY' ||
      event.capabilities?.canViewDetails !== true
    ) {
      return { link, state: 'NOT_IN_RANGE_OR_UNAVAILABLE' as const, event: null };
    }
    return {
      link,
      state: event.status === 'CANCELLED' ? ('CANCELLED' as const) : ('AVAILABLE' as const),
      event,
    };
  });
  return {
    state: eventsResult.status === 'fulfilled' ? ('LOADED' as const) : ('PARTIAL' as const),
    items,
  };
}

export async function unlinkWorkSchedule(link: WorkCalendarLink, clients = schedulingClients) {
  const result = await clients.removeWorkCalendarLink(link.linkId, link.version);
  return { link: result, calendarChanged: false as const, sourceChanged: false as const };
}
