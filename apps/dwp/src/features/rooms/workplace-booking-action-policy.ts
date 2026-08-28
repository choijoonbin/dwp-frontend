import type { WorkplaceHomeSourceState } from './workplace-home-source-state';

import type { WorkplaceBooking } from '@dwp-frontend/shared-utils';

type GovernedWorkplaceBooking = Pick<
  WorkplaceBooking,
  | 'canCancel'
  | 'canCheckIn'
  | 'canRelease'
  | 'checkInClosesAt'
  | 'checkInOpensAt'
  | 'endsAt'
  | 'startsAt'
  | 'status'
>;

export type WorkplaceBookingActionPolicy = Readonly<{
  canCheckIn: boolean;
  canRelease: boolean;
  canCancel: boolean;
}>;

export type WorkplaceBookingActionPolicyInput = Readonly<{
  booking: GovernedWorkplaceBooking;
  sourceState: WorkplaceHomeSourceState;
  canUpdateWorkplaceBooking: boolean;
  /** Caller-owned nondecreasing authority clock expressed as epoch milliseconds. */
  nowInstant: number;
}>;

const CLOSED_POLICY: WorkplaceBookingActionPolicy = Object.freeze({
  canCheckIn: false,
  canRelease: false,
  canCancel: false,
});

function instant(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function workplaceBookingActionPolicy({
  booking,
  sourceState,
  canUpdateWorkplaceBooking,
  nowInstant,
}: WorkplaceBookingActionPolicyInput): WorkplaceBookingActionPolicy {
  if (sourceState !== 'READY' || !canUpdateWorkplaceBooking || !Number.isFinite(nowInstant)) {
    return CLOSED_POLICY;
  }

  const startsAt = instant(booking.startsAt);
  const endsAt = instant(booking.endsAt);
  const checkInOpensAt = instant(booking.checkInOpensAt);
  const checkInClosesAt = instant(booking.checkInClosesAt);
  if (
    startsAt === null ||
    endsAt === null ||
    checkInOpensAt === null ||
    checkInClosesAt === null ||
    startsAt >= endsAt ||
    checkInOpensAt > checkInClosesAt
  ) {
    return CLOSED_POLICY;
  }

  const reserved = booking.status === 'RESERVED';
  const active = reserved || booking.status === 'CHECKED_IN';
  return {
    canCheckIn:
      reserved &&
      booking.canCheckIn === true &&
      checkInOpensAt <= nowInstant &&
      nowInstant <= checkInClosesAt &&
      nowInstant < endsAt,
    canRelease:
      active && booking.canRelease === true && startsAt <= nowInstant && nowInstant < endsAt,
    canCancel: reserved && booking.canCancel === true && nowInstant < startsAt,
  };
}
