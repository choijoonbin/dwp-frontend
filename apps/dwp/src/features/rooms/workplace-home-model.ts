import { Temporal } from 'temporal-polyfill';
import { workplaceBookingActionPolicy } from './workplace-booking-action-policy';
import { workplaceBookingBlockCode } from './workplace-discovery-model';

import type { WorkplaceHomeSourceState } from './workplace-home-source-state';
import type { WorkplaceBookabilityContext } from './workplace-discovery-model';
import type {
  CalendarEvent,
  CalendarHome,
  WorkplaceBooking,
  WorkplaceExploreResponse,
  WorkplaceResource,
  WorkplaceResourceType,
} from '@dwp-frontend/shared-utils';

const ACTIVE_BOOKING_STATES = new Set(['RESERVED', 'CHECKED_IN']);
const RESOURCE_ORDER: readonly WorkplaceResourceType[] = [
  'DESK',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'ROOM',
  'LOCKER',
  'PARKING',
  'EQUIPMENT',
];

export type WorkplaceHomeAgendaKind =
  'WORKSPACE' | 'MEETING' | 'FOCUS' | 'TASK' | 'OUT_OF_OFFICE' | 'REMINDER';

export type WorkplaceHomeAgendaItem = {
  key: string;
  kind: WorkplaceHomeAgendaKind;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  path: string;
  booking?: WorkplaceBooking;
};

export type WorkplaceHomeAvailability = {
  type: WorkplaceResourceType;
  available: number;
  bookable: number;
  total: number;
  accessible: number;
};

export type WorkplaceHomeWeekDay = {
  date: string;
  current: boolean;
  reservationCount: number;
  locations: string[];
  meetingMinutes: number;
  focusMinutes: number;
  loadPercent: number | null;
};

export type WorkplaceHomeAttention =
  | {
      key: string;
      kind: 'CHECK_IN' | 'RELEASE';
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      path: string;
      sortAt: string | null;
      booking: WorkplaceBooking;
    }
  | {
      key: string;
      kind: 'ROOM_NEEDED';
      severity: 'MEDIUM';
      path: string;
      sortAt: string | null;
      event: CalendarEvent;
    }
  | {
      key: string;
      kind: 'CALENDAR';
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      path: string;
      sortAt: string | null;
      title: string;
      description: string;
    };

export type WorkplaceHomeNextAction =
  | { kind: 'CHECK_IN'; booking: WorkplaceBooking; path: string }
  | { kind: 'OPEN_NEXT'; item: WorkplaceHomeAgendaItem; path: string }
  | { kind: 'BOOK_SPACE'; path: string }
  | { kind: 'BROWSE_SPACE'; path: string }
  | { kind: 'NO_SITE'; path: string }
  | { kind: 'NO_FLOOR'; path: string }
  | { kind: 'NO_RESOURCE'; path: string }
  | { kind: 'NONE'; path: string };

export type WorkplaceHomeScopeState = 'READY' | 'NO_SITE' | 'NO_FLOOR' | 'NO_RESOURCE';

export type WorkplaceHomeModel = {
  selectedSiteName: string | null;
  selectedFloorName: string | null;
  selectedFloorPlan: string | null;
  discoveryPath: string;
  discoveryPaths: Partial<Record<WorkplaceResourceType, string>>;
  availability: WorkplaceHomeAvailability[];
  availableCount: number;
  bookableCount: number;
  agenda: WorkplaceHomeAgendaItem[];
  week: WorkplaceHomeWeekDay[];
  attention: WorkplaceHomeAttention[];
  nextAction: WorkplaceHomeNextAction;
  scopeState: WorkplaceHomeScopeState;
  verifiedAt: string | null;
};

export function workplaceHomeQueryRange(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
) {
  const instant = Temporal.Instant.from(now.toISOString());
  const availabilityStart = Temporal.Instant.fromEpochMilliseconds(
    Math.floor(instant.epochMilliseconds / 60_000) * 60_000 + 60_000
  );
  const zonedNow = instant.toZonedDateTimeISO(timeZone);
  const weekStart = zonedNow.startOfDay().subtract({ days: zonedNow.dayOfWeek - 1 });
  return {
    availabilityFrom: availabilityStart.toString(),
    availabilityTo: availabilityStart.add({ hours: 1 }).toString(),
    bookingsFrom: weekStart.toInstant().toString(),
    bookingsTo: weekStart.add({ days: 7 }).toInstant().toString(),
  };
}

export function workplaceDiscoveryTarget({
  explore,
  rangeFrom,
  rangeTo,
  timeZone,
  type,
}: {
  explore?: WorkplaceExploreResponse;
  rangeFrom: string | null;
  rangeTo: string | null;
  timeZone: string;
  type?: WorkplaceResourceType;
}) {
  const params = new URLSearchParams();
  const floor = explore?.selectedFloor;
  const site = explore?.sites.find((candidate) => candidate.siteId === floor?.siteId);
  if (site) params.set('site', site.siteId);
  if (floor) params.set('floor', floor.floorId);
  if (rangeFrom) {
    const start = Temporal.Instant.from(rangeFrom).toZonedDateTimeISO(timeZone);
    params.set('date', start.toPlainDate().toString());
    params.set(
      'time',
      `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`
    );
  }
  if (rangeFrom && rangeTo) {
    const duration = Math.round((Date.parse(rangeTo) - Date.parse(rangeFrom)) / 60_000);
    if (duration > 0) params.set('duration', String(duration));
  }
  if (type) params.set('type', type);
  const query = params.toString();
  return query ? `/workplace/explore?${query}` : '/workplace/explore';
}

function verifiedDiscoveryRange(bookability: WorkplaceBookabilityContext) {
  const from = Date.parse(bookability.rangeFrom ?? '');
  const to = Date.parse(bookability.rangeTo ?? '');
  const now = Date.parse(bookability.serverNow);
  return Number.isFinite(from) &&
    Number.isFinite(to) &&
    Number.isFinite(now) &&
    from >= now &&
    to > from
    ? { from: bookability.rangeFrom, to: bookability.rangeTo }
    : { from: null, to: null };
}

function localDate(value: string, timeZone: string) {
  return Temporal.Instant.from(value).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

function visibleResource(resource: WorkplaceResource) {
  return resource.state !== 'RETIRED' && resource.mode !== 'UNAVAILABLE';
}

function immediatelyAvailable(resource: WorkplaceResource, occupiedIds: ReadonlySet<string>) {
  return (
    visibleResource(resource) &&
    resource.state === 'AVAILABLE' &&
    !occupiedIds.has(resource.resourceId)
  );
}

export function workplaceAvailability(
  explore: WorkplaceExploreResponse | undefined,
  bookability: WorkplaceBookabilityContext
): WorkplaceHomeAvailability[] {
  if (!explore?.selectedFloor) return [];
  const occupiedIds = new Set(explore.occupancy.map((item) => item.resourceId));
  const context = { ...bookability, occupancy: explore.occupancy };
  return RESOURCE_ORDER.map((type) => {
    const resources = explore.resources.filter(
      (resource) => resource.type === type && visibleResource(resource)
    );
    return {
      type,
      total: resources.length,
      available: resources.filter((resource) => immediatelyAvailable(resource, occupiedIds)).length,
      bookable: resources.filter(
        (resource) => workplaceBookingBlockCode(resource, context) === null
      ).length,
      accessible: resources.filter(
        (resource) => resource.accessible && workplaceBookingBlockCode(resource, context) === null
      ).length,
    };
  }).filter((item) => item.total > 0);
}

function calendarPath(event: CalendarEvent) {
  return `/calendar/schedule?event=${encodeURIComponent(event.eventId)}`;
}

export function workplaceAgenda({
  bookings = [],
  roomBookings = [],
  calendar,
  now,
  timeZone,
}: {
  bookings?: readonly WorkplaceBooking[];
  roomBookings?: readonly CalendarEvent[];
  calendar?: CalendarHome;
  now: string;
  timeZone: string;
}): WorkplaceHomeAgendaItem[] {
  const today = localDate(now, timeZone);
  const seenEventIds = new Set<string>();
  const items: WorkplaceHomeAgendaItem[] = [];

  for (const event of calendar?.today ?? []) {
    if (event.status === 'CANCELLED' || localDate(event.startsAt, timeZone) !== today) continue;
    seenEventIds.add(event.eventId);
    items.push({
      key: `calendar:${event.eventId}:${event.startsAt}`,
      kind: event.type,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.resource
        ? [event.resource.site, event.resource.floor].filter(Boolean).join(' · ')
        : (event.location ?? ''),
      path: calendarPath(event),
    });
  }

  for (const event of roomBookings) {
    if (
      seenEventIds.has(event.eventId) ||
      event.status === 'CANCELLED' ||
      localDate(event.startsAt, timeZone) !== today
    ) {
      continue;
    }
    seenEventIds.add(event.eventId);
    items.push({
      key: `room:${event.eventId}:${event.startsAt}`,
      kind: 'MEETING',
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.resource
        ? [event.resource.site, event.resource.floor].filter(Boolean).join(' · ')
        : (event.location ?? ''),
      path: `/workplace/my-meetings?event=${encodeURIComponent(event.eventId)}`,
    });
  }

  for (const booking of bookings) {
    if (
      !ACTIVE_BOOKING_STATES.has(booking.status) ||
      localDate(booking.startsAt, timeZone) !== today
    ) {
      continue;
    }
    items.push({
      key: `workplace:${booking.bookingId}`,
      kind: 'WORKSPACE',
      title: booking.resourceName,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      location: [booking.siteName, booking.floorName].filter(Boolean).join(' · '),
      path: `/workplace/my-bookings?booking=${encodeURIComponent(booking.bookingId)}`,
      booking,
    });
  }

  return items.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

function weekDates(now: string, timeZone: string) {
  const today = Temporal.Instant.from(now).toZonedDateTimeISO(timeZone).toPlainDate();
  const monday = today.subtract({ days: today.dayOfWeek - 1 });
  return Array.from({ length: 5 }, (_, index) => monday.add({ days: index }).toString());
}

export function workplaceWeek({
  bookings = [],
  roomBookings = [],
  calendar,
  now,
  timeZone,
}: {
  bookings?: readonly WorkplaceBooking[];
  roomBookings?: readonly CalendarEvent[];
  calendar?: CalendarHome;
  now: string;
  timeZone: string;
}): WorkplaceHomeWeekDay[] {
  const today = localDate(now, timeZone);
  const loads = new Map((calendar?.weekLoad ?? []).map((item) => [item.date, item]));
  const activeReservations = [
    ...bookings.filter((item) => ACTIVE_BOOKING_STATES.has(item.status)),
    ...roomBookings.filter((item) => item.status !== 'CANCELLED'),
  ];
  const reservationDates = activeReservations.reduce<
    Map<string, { count: number; locations: Set<string> }>
  >((result, item) => {
    const date = localDate(item.startsAt, timeZone);
    const current = result.get(date) ?? { count: 0, locations: new Set<string>() };
    current.count += 1;
    if ('siteName' in item) current.locations.add(item.siteName);
    else if (item.resource?.site) current.locations.add(item.resource.site);
    result.set(date, current);
    return result;
  }, new Map());

  return weekDates(now, timeZone).map((date) => {
    const load = loads.get(date);
    const reservations = reservationDates.get(date);
    return {
      date,
      current: date === today,
      reservationCount: reservations?.count ?? 0,
      locations: [...(reservations?.locations ?? [])].slice(0, 2),
      meetingMinutes: load?.meetingMinutes ?? 0,
      focusMinutes: load?.focusMinutes ?? 0,
      loadPercent: load?.loadPercent ?? null,
    };
  });
}

export function workplaceAttention({
  bookings = [],
  calendar,
  now,
  bookingSourceState = 'READY',
  canUpdateWorkplaceBooking = true,
}: {
  bookings?: readonly WorkplaceBooking[];
  calendar?: CalendarHome;
  now: string;
  bookingSourceState?: WorkplaceHomeSourceState;
  canUpdateWorkplaceBooking?: boolean;
}): WorkplaceHomeAttention[] {
  const items: WorkplaceHomeAttention[] = [];
  const nowInstant = Date.parse(now);
  for (const booking of bookings) {
    const path = `/workplace/my-bookings?booking=${encodeURIComponent(booking.bookingId)}`;
    const actionPolicy = workplaceBookingActionPolicy({
      booking,
      sourceState: bookingSourceState,
      canUpdateWorkplaceBooking,
      nowInstant,
    });
    if (actionPolicy.canCheckIn) {
      items.push({
        key: `check-in:${booking.bookingId}`,
        kind: 'CHECK_IN',
        severity: 'HIGH',
        path,
        sortAt: booking.checkInClosesAt ?? booking.startsAt,
        booking,
      });
    } else if (actionPolicy.canRelease) {
      items.push({
        key: `release:${booking.bookingId}`,
        kind: 'RELEASE',
        severity: 'LOW',
        path,
        sortAt: booking.endsAt,
        booking,
      });
    }
  }

  for (const event of calendar?.today ?? []) {
    if (
      event.type === 'MEETING' &&
      event.status !== 'CANCELLED' &&
      Date.parse(event.startsAt) > Date.parse(now) &&
      event.detailLevel === 'FULL' &&
      event.redacted !== true &&
      event.allDay === false &&
      event.myResponse !== 'DECLINED' &&
      event.capabilities?.canEdit === true &&
      !event.resource &&
      !event.location &&
      !event.conferenceUrl
    ) {
      items.push({
        key: `room-needed:${event.eventId}`,
        kind: 'ROOM_NEEDED',
        severity: 'MEDIUM',
        path: calendarPath(event),
        sortAt: event.startsAt,
        event,
      });
    }
  }

  for (const item of calendar?.attention ?? []) {
    const event = calendar?.today.find((candidate) => candidate.eventId === item.eventId);
    items.push({
      key: `calendar:${item.key}`,
      kind: 'CALENDAR',
      severity: item.severity,
      path: item.eventId
        ? `${item.actionPath}?event=${encodeURIComponent(item.eventId)}`
        : item.actionPath,
      sortAt: event?.startsAt ?? null,
      title: item.title,
      description: item.description,
    });
  }
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  return items
    .sort((left, right) => {
      const severity = severityOrder[left.severity] - severityOrder[right.severity];
      if (severity) return severity;
      const leftAt = left.sortAt ? Date.parse(left.sortAt) : Number.POSITIVE_INFINITY;
      const rightAt = right.sortAt ? Date.parse(right.sortAt) : Number.POSITIVE_INFINITY;
      return leftAt - rightAt || left.key.localeCompare(right.key);
    })
    .slice(0, 5);
}

function verifiedAt(values: Array<string | undefined>) {
  const valid = values.filter((value): value is string => Boolean(value));
  if (!valid.length) return null;
  return valid.sort()[0] ?? null;
}

export function buildWorkplaceHomeModel({
  explore,
  bookings,
  roomBookings,
  calendar,
  bookability,
  now,
  timeZone,
  bookingSourceState = 'READY',
  canUpdateWorkplaceBooking = true,
}: {
  explore?: WorkplaceExploreResponse;
  bookings?: readonly WorkplaceBooking[];
  roomBookings?: readonly CalendarEvent[];
  calendar?: CalendarHome;
  bookability: WorkplaceBookabilityContext;
  now: string;
  timeZone: string;
  bookingSourceState?: WorkplaceHomeSourceState;
  canUpdateWorkplaceBooking?: boolean;
}): WorkplaceHomeModel {
  const selectedFloor = explore?.selectedFloor ?? null;
  const selectedSite = explore?.sites.find((site) => site.siteId === selectedFloor?.siteId) ?? null;
  const availability = workplaceAvailability(explore, bookability);
  const discoveryRange = verifiedDiscoveryRange(bookability);
  const discoveryPath = workplaceDiscoveryTarget({
    explore,
    rangeFrom: discoveryRange.from,
    rangeTo: discoveryRange.to,
    timeZone,
  });
  const discoveryPaths = Object.fromEntries(
    availability.map((item) => [
      item.type,
      workplaceDiscoveryTarget({
        explore,
        rangeFrom: discoveryRange.from,
        rangeTo: discoveryRange.to,
        timeZone,
        type: item.type,
      }),
    ])
  ) as Partial<Record<WorkplaceResourceType, string>>;
  const agenda = workplaceAgenda({ bookings, roomBookings, calendar, now, timeZone });
  const attention = workplaceAttention({
    bookings,
    calendar,
    now,
    bookingSourceState,
    canUpdateWorkplaceBooking,
  });
  const nowInstant = Date.parse(now);
  const checkIn = (bookings ?? [])
    .filter(
      (booking) =>
        workplaceBookingActionPolicy({
          booking,
          sourceState: bookingSourceState,
          canUpdateWorkplaceBooking,
          nowInstant,
        }).canCheckIn
    )
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];
  const nextAgenda = agenda.find((item) => Date.parse(item.endsAt) > nowInstant);
  const availableCount = availability.reduce((sum, item) => sum + item.available, 0);
  const bookableCount = availability.reduce((sum, item) => sum + item.bookable, 0);
  const scopeState: WorkplaceHomeScopeState = !explore?.sites.length
    ? 'NO_SITE'
    : !selectedFloor
      ? 'NO_FLOOR'
      : explore.resources.length === 0
        ? 'NO_RESOURCE'
        : 'READY';
  const nextAction: WorkplaceHomeNextAction = checkIn
    ? {
        kind: 'CHECK_IN',
        booking: checkIn,
        path: `/workplace/my-bookings?booking=${encodeURIComponent(checkIn.bookingId)}`,
      }
    : nextAgenda
      ? { kind: 'OPEN_NEXT', item: nextAgenda, path: nextAgenda.path }
      : scopeState === 'NO_SITE'
        ? { kind: 'NO_SITE', path: '/workplace/explore' }
        : scopeState === 'NO_FLOOR'
          ? { kind: 'NO_FLOOR', path: '/workplace/explore' }
          : scopeState === 'NO_RESOURCE'
            ? { kind: 'NO_RESOURCE', path: '/workplace/explore' }
            : bookableCount > 0
              ? {
                  kind: 'BOOK_SPACE',
                  path:
                    discoveryPaths[
                      availability.find((item) => item.bookable > 0)?.type ?? 'DESK'
                    ] ?? discoveryPath,
                }
              : availableCount > 0
                ? {
                    kind: 'BROWSE_SPACE',
                    path:
                      discoveryPaths[
                        availability.find((item) => item.available > 0)?.type ?? 'DESK'
                      ] ?? discoveryPath,
                  }
                : { kind: 'NONE', path: discoveryPath };

  return {
    selectedSiteName: selectedSite?.name ?? null,
    selectedFloorName: selectedFloor?.name ?? null,
    selectedFloorPlan: selectedFloor?.backgroundAssetPath ?? null,
    discoveryPath,
    discoveryPaths,
    availability,
    availableCount,
    bookableCount,
    agenda,
    week: workplaceWeek({ bookings, roomBookings, calendar, now, timeZone }),
    attention,
    nextAction,
    scopeState,
    verifiedAt: verifiedAt([explore?.generatedAt, calendar?.generatedAt]),
  };
}
