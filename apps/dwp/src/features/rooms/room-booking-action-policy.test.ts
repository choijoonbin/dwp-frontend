import { describe, expect, it } from 'vitest';

import { roomBookingActionPolicy } from './room-booking-action-policy';

describe('roomBookingActionPolicy', () => {
  it('fails closed when server event capabilities are absent', () => {
    expect(
      roomBookingActionPolicy(
        { capabilities: undefined, myResponse: null, status: 'CONFIRMED' },
        true
      )
    ).toEqual({ canEdit: false, canCancel: false, canRespond: false });
  });

  it('requires both the app permission and each server event capability', () => {
    const event = {
      status: 'CONFIRMED' as const,
      myResponse: 'NEEDS_ACTION' as const,
      capabilities: {
        canViewDetails: true,
        canEdit: true,
        canDelete: false,
        canRestore: false,
        canRespond: true,
        canStar: true,
      },
    };

    expect(roomBookingActionPolicy(event, false)).toEqual({
      canEdit: false,
      canCancel: false,
      canRespond: false,
    });
    expect(roomBookingActionPolicy(event, true)).toEqual({
      canEdit: true,
      canCancel: false,
      canRespond: true,
    });
  });
});
