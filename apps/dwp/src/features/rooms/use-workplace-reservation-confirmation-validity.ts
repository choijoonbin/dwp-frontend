import { useEffect } from 'react';

import { roomBookingActionPolicy } from './room-booking-action-policy';
import { workplaceBookingActionPolicy } from './workplace-booking-action-policy';

import type { CalendarEvent, WorkplaceBooking } from '@dwp-frontend/shared-utils';
import type { WorkplaceHomeSourceState } from './workplace-home-source-state';
import type { WorkplaceReservationConfirmation } from './workplace-unified-reservations-runtime';

type ConfirmationValidity = Readonly<{
  advance: () => void;
  calendarEvents: readonly CalendarEvent[];
  calendarPending: boolean;
  calendarState: WorkplaceHomeSourceState;
  canUpdateRoomBooking: boolean;
  canUpdateWorkplaceBooking: boolean;
  confirmation: WorkplaceReservationConfirmation | null;
  nowInstant: number;
  onInvalid: () => void;
  workplaceBookings: readonly WorkplaceBooking[];
  workplacePending: boolean;
  workplaceState: WorkplaceHomeSourceState;
}>;

export function useWorkplaceReservationConfirmationValidity({
  advance,
  calendarEvents,
  calendarPending,
  calendarState,
  canUpdateRoomBooking,
  canUpdateWorkplaceBooking,
  confirmation,
  nowInstant,
  onInvalid,
  workplaceBookings,
  workplacePending,
  workplaceState,
}: ConfirmationValidity) {
  useEffect(() => {
    const timer = window.setInterval(advance, 1_000);
    return () => window.clearInterval(timer);
  }, [advance]);

  useEffect(() => {
    if (!confirmation || workplacePending || calendarPending) return;
    if (confirmation.authority === 'WORKPLACE') {
      const current = workplaceBookings.find(
        (booking) => booking.bookingId === confirmation.authorityId
      );
      const policy = current
        ? workplaceBookingActionPolicy({
            booking: current,
            sourceState: workplaceState,
            canUpdateWorkplaceBooking,
            nowInstant,
          })
        : null;
      if (
        !current ||
        current.version !== confirmation.version ||
        !(confirmation.action === 'release' ? policy?.canRelease : policy?.canCancel)
      ) {
        onInvalid();
      }
      return;
    }
    const current = calendarEvents.find((event) => event.eventId === confirmation.authorityId);
    if (
      !current ||
      current.version !== confirmation.version ||
      calendarState !== 'READY' ||
      !roomBookingActionPolicy(current, canUpdateRoomBooking).canCancel
    ) {
      onInvalid();
    }
  }, [
    calendarEvents,
    calendarPending,
    calendarState,
    canUpdateRoomBooking,
    canUpdateWorkplaceBooking,
    confirmation,
    nowInstant,
    onInvalid,
    workplaceBookings,
    workplacePending,
    workplaceState,
  ]);
}
