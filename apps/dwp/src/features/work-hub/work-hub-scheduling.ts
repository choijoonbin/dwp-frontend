import {
  createCalendarEvent,
  getCalendarEvents,
  type CalendarEvent,
  type CalendarSummary,
  type CreateCalendarEventInput,
} from '@dwp-frontend/shared-utils/api/calendar-api';
import {
  createWorkCalendarEventHandoff,
  getWorkCalendarLinks,
  putWorkCalendarLink,
  removeWorkCalendarLink,
  workCalendarEventHandoffDescription,
  workCalendarInternalPath,
  type WorkCalendarEventHandoffState,
  type WorkCalendarLink,
} from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import type { WorkSourceReference } from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import {
  workHubItemRoute,
  workHubReferenceKey,
  type WorkHubItem,
  type WorkHubSnapshot,
} from './work-hub-contracts';
import {
  canUseWorkHubGenericAdjunct,
  isWorkHubItemCommandReady,
  isWorkHubSourceCommandReady,
} from './work-hub-command-authority';
import { resolveZonedClock } from '@dwp-frontend/shared-i18n';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils/http-error';
import { Temporal } from 'temporal-polyfill';

export type WorkScheduleDraftInput = {
  startsAt: string;
  endsAt: string;
  timeZone: string;
  title: string;
};

export type WorkScheduleCommand = {
  linkId: string;
  work: WorkSourceReference;
  reviewedItemSourceId: WorkHubItem['sourceId'];
  reviewedItemSourceStatus: string;
  reviewedItemVersion: number;
  reviewedItemLifecycle: WorkHubItem['lifecycle'];
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
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type WorkScheduleExecutionGuard = {
  signal?: AbortSignal;
  canContinue?: () => boolean;
};

export function workScheduleEventTitle(value: string): string {
  const title = value.trim();
  if (title.length <= 300) return title;
  const segments = new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(title);
  let result = '';
  for (const { segment } of segments) {
    if (result.length + segment.length + 1 > 300) break;
    result += segment;
  }
  return `${result}…`;
}

/** Work focus starts at the next half-hour and defaults to one 30-minute block. */
export function createWorkScheduleDraft(
  input: Pick<WorkScheduleDraftInput, 'title' | 'timeZone'>,
  now = new Date()
): WorkScheduleDraftInput {
  const title = workScheduleEventTitle(input.title);
  if (!title || title.length > 300 || !Number.isFinite(now.getTime()))
    throw new Error('A reviewed schedule title and valid time are required.');
  try {
    const localNow = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(input.timeZone);
    const localStart = (
      localNow.minute < 30
        ? localNow.with({ minute: 30 })
        : localNow.add({ hours: 1 }).with({ minute: 0 })
    ).with({ second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
    const starts = localStart.toInstant();
    return {
      startsAt: new Date(starts.epochMilliseconds).toISOString(),
      endsAt: new Date(starts.add({ minutes: 30 }).epochMilliseconds).toISOString(),
      timeZone: input.timeZone,
      title,
    };
  } catch {
    throw new Error('A valid schedule time zone is required.');
  }
}

export function workScheduleSourceUrl(item: Pick<WorkHubItem, 'reference'>): string {
  const route = workHubItemRoute(item.reference);
  const canonical = workCalendarInternalPath(route, true);
  if (!canonical) throw new Error('A canonical Work item link is required.');
  return canonical;
}

export function workScheduleEventDescription(item: Pick<WorkHubItem, 'reference'>): string {
  return workCalendarEventHandoffDescription({
    work: item.reference,
    sourceUrl: workScheduleSourceUrl(item),
  });
}

/** Produces short-lived, validated state for the Calendar event composer. */
export function createWorkScheduleHandoffState(
  item: Pick<WorkHubItem, 'reference'>,
  draft: WorkScheduleDraftInput,
  returnTo: string,
  ownerFingerprint: string,
  now = new Date()
): WorkCalendarEventHandoffState {
  return {
    workCalendarEventHandoff: createWorkCalendarEventHandoff(
      {
        ownerFingerprint,
        work: item.reference,
        sourceUrl: workScheduleSourceUrl(item),
        returnTo,
        ...draft,
      },
      now
    ),
  };
}

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

function failure(error: unknown, signal?: AbortSignal) {
  if (
    signal?.aborted ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof HttpTransportError && error.reason === 'ABORT')
  ) {
    return { reason: 'CANCELLED', retryable: true };
  }
  if (error instanceof HttpError) {
    if ([401, 403, 404].includes(error.status)) return { reason: 'FORBIDDEN', retryable: false };
    if (error.status === 409) return { reason: 'CONFLICT', retryable: false };
    if ([400, 422].includes(error.status)) return { reason: 'INVALID', retryable: false };
  }
  return { reason: 'UNAVAILABLE', retryable: true };
}

function canContinue(guard: WorkScheduleExecutionGuard) {
  return guard.signal?.aborted !== true && (guard.canContinue?.() ?? true);
}

function exactWorkReference(left: WorkSourceReference, right: WorkSourceReference) {
  return (
    left.sourceSystem === right.sourceSystem &&
    left.sourceReference === right.sourceReference &&
    (left.obligationKey ?? null) === (right.obligationKey ?? null)
  );
}

const terminalWorkLifecycles = new Set<WorkHubItem['lifecycle']>([
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

export function isExactWorkScheduleCommandIdentity(
  command: WorkScheduleCommand,
  itemKey: string
): boolean {
  try {
    return (
      command.work.sourceSystem !== 'WORK_ASSIGNMENT' &&
      uuid.test(command.linkId) &&
      command.eventInput.idempotencyKey === command.linkId &&
      workHubReferenceKey(command.work) === itemKey &&
      typeof command.reviewedItemSourceId === 'string' &&
      command.reviewedItemSourceId.length > 0 &&
      typeof command.reviewedItemSourceStatus === 'string' &&
      command.reviewedItemSourceStatus.length > 0 &&
      Number.isSafeInteger(command.reviewedItemVersion) &&
      command.reviewedItemVersion >= 0 &&
      !terminalWorkLifecycles.has(command.reviewedItemLifecycle)
    );
  } catch {
    return false;
  }
}

/** A reviewed schedule command is valid only for the exact current, active Work receipt. */
export function isExactWorkScheduleCommandForItem(
  command: WorkScheduleCommand,
  item: WorkHubItem
): boolean {
  return (
    isExactWorkScheduleCommandIdentity(command, item.key) &&
    exactWorkReference(command.work, item.reference) &&
    command.reviewedItemSourceId === item.sourceId &&
    command.reviewedItemSourceStatus === item.sourceStatus &&
    command.reviewedItemVersion === item.version &&
    command.reviewedItemLifecycle === item.lifecycle &&
    !terminalWorkLifecycles.has(item.lifecycle)
  );
}

/** Requires a successful source read so a retained outage row cannot authorize a new event. */
export function isFreshWorkScheduleCommand(
  command: WorkScheduleCommand,
  snapshot: WorkHubSnapshot | null | undefined
): boolean {
  if (
    !snapshot ||
    snapshot.completeness === 'UNAVAILABLE' ||
    !isWorkHubSourceCommandReady(snapshot, 'personal')
  )
    return false;
  const matches = snapshot.items.filter((item) => exactWorkReference(item.reference, command.work));
  if (matches.length !== 1) return false;
  const item = matches[0]!;
  return (
    isWorkHubItemCommandReady(snapshot, item) && isExactWorkScheduleCommandForItem(command, item)
  );
}

/** A 2xx response is evidence only when it echoes every reviewed event identity field. */
export function isExactCalendarEventReceipt(
  event: CalendarEvent | null | undefined,
  command: WorkScheduleCommand
): boolean {
  if (!event || typeof event !== 'object') return false;
  const input = command.eventInput;
  return (
    uuid.test(event.eventId) &&
    event.calendarId === input.calendarId &&
    event.title === input.title &&
    (event.description ?? null) === (input.description ?? null) &&
    event.type === input.type &&
    event.startsAt === input.startsAt &&
    event.endsAt === input.endsAt &&
    event.timeZone === input.timeZone &&
    event.allDay === input.allDay &&
    event.visibility === input.visibility &&
    event.recurrence === input.recurrence &&
    event.recurrenceInterval === input.recurrenceInterval &&
    event.responseRequired === input.responseRequired &&
    Array.isArray(event.attendees) &&
    event.attendees.length === input.attendees.length &&
    event.status === 'CONFIRMED' &&
    Number.isSafeInteger(event.version) &&
    event.version >= 0
  );
}

/** Work never treats a generic 2xx as proof that its exact relationship was saved. */
export function isExactWorkCalendarLinkReceipt(
  link: WorkCalendarLink | null | undefined,
  command: WorkScheduleCommand,
  event: CalendarEvent
): boolean {
  if (!link || typeof link !== 'object') return false;
  return (
    link.linkId === command.linkId &&
    exactWorkReference(link.work, command.work) &&
    link.eventId === event.eventId &&
    link.state === 'LINKED' &&
    link.calendarAvailability === 'REFERENCE_ONLY' &&
    Number.isSafeInteger(link.version) &&
    link.version >= 0
  );
}

export function isExactWorkCalendarUnlinkReceipt(
  receipt: WorkCalendarLink | null | undefined,
  previous: WorkCalendarLink
): boolean {
  if (!receipt || typeof receipt !== 'object') return false;
  return (
    receipt.linkId === previous.linkId &&
    exactWorkReference(receipt.work, previous.work) &&
    receipt.eventId === previous.eventId &&
    receipt.state === 'REMOVED' &&
    receipt.calendarAvailability === 'REFERENCE_ONLY' &&
    Number.isSafeInteger(receipt.version) &&
    receipt.version > previous.version
  );
}

/** Selects one still-current relationship and rejects missing, changed, removed or duplicate ids. */
export function exactCurrentWorkScheduleLink(
  candidates: readonly WorkCalendarLink[],
  reviewed: WorkCalendarLink
): WorkCalendarLink | null {
  if (!isValidScheduleLink(reviewed) || reviewed.state !== 'LINKED') return null;
  const matches = candidates.filter((candidate) => candidate.linkId === reviewed.linkId);
  if (matches.length !== 1) return null;
  const current = matches[0]!;
  return isValidScheduleLink(current) &&
    current.state === 'LINKED' &&
    exactWorkReference(current.work, reviewed.work) &&
    current.eventId === reviewed.eventId &&
    current.version === reviewed.version
    ? current
    : null;
}

/** One user-reviewed command retains both identifiers across retries. */
export function prepareWorkSchedule(
  item: WorkHubItem,
  calendar: CalendarSummary,
  input: WorkScheduleDraftInput,
  linkId = crypto.randomUUID()
): WorkScheduleCommand {
  if (!canUseWorkHubGenericAdjunct(item, 'CALENDAR'))
    throw new Error('This work source does not support Calendar scheduling.');
  if (calendar.type !== 'PERSONAL' || !calendar.capabilities?.canCreateEvents)
    throw new Error('Choose an editable personal calendar.');
  if (terminalWorkLifecycles.has(item.lifecycle)) throw new Error('This work is no longer active.');
  if (!Number.isSafeInteger(item.version) || item.version < 0)
    throw new Error('A current work receipt is required.');
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
    reviewedItemSourceId: item.sourceId,
    reviewedItemSourceStatus: item.sourceStatus,
    reviewedItemVersion: item.version,
    reviewedItemLifecycle: item.lifecycle,
    eventInput: {
      title,
      description: workScheduleEventDescription(item),
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
  guard: WorkScheduleExecutionGuard = {},
  clients = schedulingClients
): Promise<WorkScheduleResult> {
  let itemKey = '';
  try {
    itemKey = workHubReferenceKey(command.work);
  } catch {
    // The rejection below keeps malformed commands away from Calendar.
  }
  if (!isExactWorkScheduleCommandIdentity(command, itemKey)) {
    return {
      state: 'CALENDAR_REJECTED',
      command,
      sourceChanged: false,
      reason: 'INVALID_COMMAND',
      retryable: false,
    };
  }
  if (!canContinue(guard)) {
    if (confirmedEvent) {
      return {
        state: 'LINK_PENDING',
        command,
        event: confirmedEvent,
        sourceChanged: false,
        reason: 'CANCELLED',
        retryable: true,
      };
    }
    return {
      state: 'CALENDAR_UNCONFIRMED',
      command,
      sourceChanged: false,
      reason: 'CANCELLED',
      retryable: true,
    };
  }
  let event = confirmedEvent;
  if (!event) {
    try {
      event = await clients.createCalendarEvent(command.eventInput, guard.signal);
    } catch (error) {
      const problem = failure(error, guard.signal);
      return {
        state: problem.retryable ? 'CALENDAR_UNCONFIRMED' : 'CALENDAR_REJECTED',
        command,
        sourceChanged: false,
        ...problem,
      };
    }
  }
  if (!isExactCalendarEventReceipt(event, command)) {
    return {
      state: 'CALENDAR_UNCONFIRMED',
      command,
      sourceChanged: false,
      reason: 'INVALID_RECEIPT',
      retryable: true,
    };
  }
  if (!canContinue(guard)) {
    return {
      state: 'LINK_PENDING',
      command,
      event,
      sourceChanged: false,
      reason: 'CANCELLED',
      retryable: true,
    };
  }
  try {
    const link = await clients.putWorkCalendarLink(
      command.linkId,
      {
        work: command.work,
        eventId: event.eventId,
      },
      guard.signal
    );
    if (!canContinue(guard) || !isExactWorkCalendarLinkReceipt(link, command, event)) {
      return {
        state: 'LINK_PENDING',
        command,
        event,
        sourceChanged: false,
        reason: canContinue(guard) ? 'INVALID_RECEIPT' : 'CANCELLED',
        retryable: true,
      };
    }
    return {
      state: 'SCHEDULED',
      command,
      event,
      link,
      sourceChanged: false,
    };
  } catch (error) {
    return {
      state: 'LINK_PENDING',
      command,
      event,
      sourceChanged: false,
      ...failure(error, guard.signal),
    };
  }
}

function isValidScheduleLink(link: WorkCalendarLink): boolean {
  return (
    typeof link === 'object' &&
    link !== null &&
    uuid.test(link.linkId) &&
    uuid.test(link.eventId) &&
    typeof link.work?.sourceSystem === 'string' &&
    link.work.sourceSystem.length > 0 &&
    typeof link.work.sourceReference === 'string' &&
    link.work.sourceReference.length > 0 &&
    ['LINKED', 'REMOVED'].includes(link.state) &&
    link.calendarAvailability === 'REFERENCE_ONLY' &&
    Number.isSafeInteger(link.version) &&
    link.version >= 0
  );
}

export async function loadWorkSchedules(
  from: string,
  to: string,
  guard: WorkScheduleExecutionGuard = {},
  clients = schedulingClients
) {
  if (!canContinue(guard)) throw new DOMException('Work owner changed', 'AbortError');
  const [linksResult, eventsResult] = await Promise.allSettled([
    (async () => {
      const items: WorkCalendarLink[] = [];
      const seen = new Set<string>();
      let expectedTotal: number | null = null;
      for (let page = 0; page < 100; page++) {
        const result = await clients.getWorkCalendarLinks(page, 100, guard.signal);
        if (!canContinue(guard)) throw new DOMException('Work owner changed', 'AbortError');
        if (
          !result ||
          result.page !== page ||
          result.size !== 100 ||
          !Number.isSafeInteger(result.totalElements) ||
          result.totalElements < 0 ||
          result.totalElements > 10_000 ||
          typeof result.hasMore !== 'boolean' ||
          !Array.isArray(result.items) ||
          result.items.length > 100 ||
          (expectedTotal !== null && result.totalElements !== expectedTotal)
        ) {
          throw new Error('Calendar link pagination receipt is invalid.');
        }
        expectedTotal = result.totalElements;
        for (const link of result.items) {
          if (!isValidScheduleLink(link) || seen.has(link.linkId))
            throw new Error('Calendar link pagination did not make unique progress.');
          seen.add(link.linkId);
        }
        items.push(...result.items);
        if (result.hasMore) {
          if (result.items.length === 0 || items.length >= result.totalElements)
            throw new Error('Calendar link pagination did not make progress.');
          continue;
        }
        if (items.length !== result.totalElements)
          throw new Error('Calendar link pagination total does not match its receipts.');
        return items;
      }
      throw new Error('Calendar link pagination exceeded its supported range.');
    })(),
    (async () => {
      const events = await clients.getCalendarEvents(from, to, guard.signal);
      if (
        !Array.isArray(events) ||
        events.some(
          (event) =>
            !event ||
            typeof event !== 'object' ||
            typeof event.eventId !== 'string' ||
            event.eventId.length === 0
        ) ||
        new Set(events.map((event) => event.eventId)).size !== events.length
      )
        throw new Error('Calendar event receipt is invalid.');
      return events;
    })(),
  ]);
  if (!canContinue(guard)) throw new DOMException('Work owner changed', 'AbortError');
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

export async function unlinkWorkSchedule(
  link: WorkCalendarLink,
  guard: WorkScheduleExecutionGuard = {},
  clients = schedulingClients
) {
  if (!canContinue(guard)) throw new DOMException('Work owner changed', 'AbortError');
  const result = await clients.removeWorkCalendarLink(link.linkId, link.version, guard.signal);
  if (!canContinue(guard)) throw new DOMException('Work owner changed', 'AbortError');
  if (!isExactWorkCalendarUnlinkReceipt(result, link))
    throw new Error('The unlink receipt does not match the reviewed relationship.');
  return { link: result, calendarChanged: false as const, sourceChanged: false as const };
}
