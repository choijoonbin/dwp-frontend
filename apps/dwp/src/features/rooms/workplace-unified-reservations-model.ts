import type { CalendarEvent, WorkplaceBooking } from '@dwp-frontend/shared-utils';
import type { WorkplaceHomeSourceState } from './workplace-home-source-state';
import type {
  WorkplaceReservationAuthorityFilter,
  WorkplaceReservationStatus,
  WorkplaceReservationType,
} from './workplace-reservations-url-state';

export type WorkplaceReservationAuthority = 'WORKPLACE' | 'CALENDAR';

export type WorkplaceUnifiedReservation = Readonly<{
  key: string;
  authority: WorkplaceReservationAuthority;
  authorityId: string;
  resourceId: string;
  title: string;
  resourceType: WorkplaceBooking['resourceType'] | 'ROOM';
  location: string;
  startsAt: string;
  endsAt: string;
  timeZone: string | null;
  state: WorkplaceBooking['status'] | CalendarEvent['status'];
  sourceState: Extract<WorkplaceHomeSourceState, 'READY' | 'STALE'>;
  detailPath: string;
  version: number;
  checkInOpensAt: string | null;
  checkInClosesAt: string | null;
  attendeeCount: number | null;
  organizerName: string | null;
  canCheckIn: boolean;
  canRelease: boolean;
  canCancel: boolean;
  canRespond: boolean;
  canEdit: boolean;
}>;

export type WorkplaceUnifiedReservationProjection = Readonly<{
  items: readonly WorkplaceUnifiedReservation[];
  sources: Readonly<{
    workplace: WorkplaceHomeSourceState;
    calendar: WorkplaceHomeSourceState;
  }>;
  partial: boolean;
}>;

export function workplaceUnifiedReservationTargetId(item: WorkplaceUnifiedReservation) {
  return `workplace-reservation-${item.authority.toLowerCase()}-${item.authorityId.replace(/[^a-zA-Z0-9_-]/gu, '-')}`;
}

function validWindow(startsAt: string, endsAt: string) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function visibleSource(state: WorkplaceHomeSourceState): state is 'READY' | 'STALE' {
  return state === 'READY' || state === 'STALE';
}

function workplaceReservation(
  booking: WorkplaceBooking,
  sourceState: 'READY' | 'STALE'
): WorkplaceUnifiedReservation | null {
  if (!validWindow(booking.startsAt, booking.endsAt)) return null;
  return {
    key: `WORKPLACE:${booking.bookingId}`,
    authority: 'WORKPLACE',
    authorityId: booking.bookingId,
    resourceId: booking.resourceId,
    title: booking.resourceName,
    resourceType: booking.resourceType,
    location: [booking.siteName, booking.floorName].filter(Boolean).join(' · '),
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    timeZone: null,
    state: booking.status,
    sourceState,
    detailPath: `/workplace/reservations?reservationAuthority=WORKPLACE&reservation=${encodeURIComponent(booking.bookingId)}`,
    version: booking.version,
    checkInOpensAt: booking.checkInOpensAt,
    checkInClosesAt: booking.checkInClosesAt,
    attendeeCount: null,
    organizerName: null,
    canCheckIn: sourceState === 'READY' && booking.canCheckIn,
    canRelease: sourceState === 'READY' && booking.canRelease,
    canCancel: sourceState === 'READY' && booking.canCancel,
    canRespond: false,
    canEdit: sourceState === 'READY' && booking.status === 'RESERVED',
  };
}

function calendarReservation(
  event: CalendarEvent,
  sourceState: 'READY' | 'STALE'
): WorkplaceUnifiedReservation | null {
  if (!event.resource || !validWindow(event.startsAt, event.endsAt)) return null;
  return {
    key: `CALENDAR:${event.eventId}`,
    authority: 'CALENDAR',
    authorityId: event.eventId,
    resourceId: event.resource.resourceId,
    title: event.detailLevel === 'FREE_BUSY' || event.redacted ? event.resource.name : event.title,
    resourceType: 'ROOM',
    location: [event.resource.site, event.resource.floor].filter(Boolean).join(' · '),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timeZone: event.timeZone,
    state: event.status,
    sourceState,
    detailPath: `/workplace/reservations?reservationAuthority=CALENDAR&reservation=${encodeURIComponent(event.eventId)}`,
    version: event.version,
    checkInOpensAt: null,
    checkInClosesAt: null,
    attendeeCount: event.attendees.length,
    organizerName: event.organizerName,
    canCheckIn: false,
    canRelease: false,
    canCancel: sourceState === 'READY' && Boolean(event.capabilities?.canDelete),
    canRespond: sourceState === 'READY' && Boolean(event.capabilities?.canRespond),
    canEdit: sourceState === 'READY' && Boolean(event.capabilities?.canEdit),
  };
}

const TERMINAL_STATES = new Set<WorkplaceUnifiedReservation['state']>([
  'COMPLETED',
  'NO_SHOW',
  'RELEASED',
  'CANCELLED',
]);

function matchesType(item: WorkplaceUnifiedReservation, type: WorkplaceReservationType) {
  if (type === 'ALL') return true;
  if (type === 'WORKSPACE') return item.authority === 'WORKPLACE';
  if (type === 'MEETING') return item.authority === 'CALENDAR';
  return item.resourceType === type;
}

function matchesStatus(item: WorkplaceUnifiedReservation, status: WorkplaceReservationStatus) {
  if (status === 'ALL') return true;
  if (status === 'ACTIVE') return !TERMINAL_STATES.has(item.state);
  return item.state === status;
}

export function filterWorkplaceUnifiedReservations(
  items: readonly WorkplaceUnifiedReservation[],
  filters: Readonly<{
    type: WorkplaceReservationType;
    status: WorkplaceReservationStatus;
    authority: WorkplaceReservationAuthorityFilter;
    query: string;
  }>
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      (filters.authority === 'ALL' || item.authority === filters.authority) &&
      matchesType(item, filters.type) &&
      matchesStatus(item, filters.status) &&
      (!query ||
        item.title.toLocaleLowerCase().includes(query) ||
        item.location.toLocaleLowerCase().includes(query))
  );
}

export function selectWorkplaceUnifiedReservation(
  items: readonly WorkplaceUnifiedReservation[],
  selection: Readonly<{
    reservationId: string | null;
    reservationAuthority: WorkplaceReservationAuthority | null;
  }>,
  allowFirstItemFallback: boolean
) {
  const explicit = items.find(
    (item) =>
      item.authorityId === selection.reservationId &&
      item.authority === selection.reservationAuthority
  );
  return explicit ?? (allowFirstItemFallback ? items[0] : null) ?? null;
}

export function projectWorkplaceUnifiedReservations({
  workplace = [],
  calendar = [],
  workplaceState,
  calendarState,
}: {
  workplace?: readonly WorkplaceBooking[];
  calendar?: readonly CalendarEvent[];
  workplaceState: WorkplaceHomeSourceState;
  calendarState: WorkplaceHomeSourceState;
}): WorkplaceUnifiedReservationProjection {
  const items: WorkplaceUnifiedReservation[] = [];
  if (visibleSource(workplaceState)) {
    for (const booking of workplace) {
      const item = workplaceReservation(booking, workplaceState);
      if (item) items.push(item);
    }
  }
  if (visibleSource(calendarState)) {
    for (const event of calendar) {
      const item = calendarReservation(event, calendarState);
      if (item) items.push(item);
    }
  }
  items.sort(
    (left, right) =>
      Date.parse(left.startsAt) - Date.parse(right.startsAt) || left.key.localeCompare(right.key)
  );
  return {
    items,
    sources: { workplace: workplaceState, calendar: calendarState },
    partial: workplaceState !== 'READY' || calendarState !== 'READY',
  };
}
