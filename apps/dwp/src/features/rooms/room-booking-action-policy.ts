import type { CalendarEvent } from '@dwp-frontend/shared-utils';

export type RoomBookingActionPolicy = Readonly<{
  canEdit: boolean;
  canCancel: boolean;
  canRespond: boolean;
}>;

export function roomBookingActionPolicy(
  event: Pick<CalendarEvent, 'capabilities' | 'myResponse' | 'status'>,
  canUpdateRoomBooking: boolean
): RoomBookingActionPolicy {
  const active = canUpdateRoomBooking && event.status !== 'CANCELLED';
  return {
    canEdit: active && event.capabilities?.canEdit === true,
    canCancel: active && event.capabilities?.canDelete === true,
    canRespond:
      active && event.myResponse === 'NEEDS_ACTION' && event.capabilities?.canRespond === true,
  };
}
