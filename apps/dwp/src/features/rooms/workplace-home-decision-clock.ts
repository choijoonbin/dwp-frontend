import type { CalendarEvent, CalendarHome, WorkplaceBooking } from '@dwp-frontend/shared-utils';

type WorkplaceHomeDecisionDeadlineInput = {
  now: string;
  availabilityFrom?: string | null;
  bookings?: readonly WorkplaceBooking[];
  roomBookings?: readonly CalendarEvent[];
  calendar?: CalendarHome;
};

function instant(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function latestWorkplaceDecisionInstant(
  wallClock: number,
  ...sourceInstants: Array<string | null | undefined>
) {
  return sourceInstants.reduce((latest, value) => {
    const parsed = instant(value);
    return parsed === null ? latest : Math.max(latest, parsed);
  }, wallClock);
}

export function workplaceHomeDecisionDeadline({
  now,
  availabilityFrom,
  bookings = [],
  roomBookings = [],
  calendar,
}: WorkplaceHomeDecisionDeadlineInput) {
  const nowInstant = instant(now);
  if (nowInstant === null) return null;

  const candidates = [
    availabilityFrom,
    ...bookings.flatMap((booking) => [
      booking.checkInOpensAt,
      booking.checkInClosesAt,
      booking.startsAt,
      booking.endsAt,
    ]),
    ...roomBookings.flatMap((booking) => [booking.startsAt, booking.endsAt]),
    ...(calendar?.today ?? []).flatMap((event) => [event.startsAt, event.endsAt]),
    calendar?.nextEvent?.startsAt,
    calendar?.nextEvent?.endsAt,
  ]
    .map(instant)
    .filter((value): value is number => value !== null && value > nowInstant);

  return candidates.length ? Math.min(...candidates) : null;
}
