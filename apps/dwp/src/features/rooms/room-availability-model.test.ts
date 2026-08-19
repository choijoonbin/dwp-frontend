import { describe, expect, it } from 'vitest';

import { roomSlotAvailable, roomSlotOverlaps } from './room-availability-model';

const occupancy = [
  {
    resourceId: 'room-1',
    startsAt: '2026-08-19T10:00:00+09:00',
    endsAt: '2026-08-19T11:00:00+09:00',
    bookingStatus: 'CONFIRMED' as const,
  },
];

describe('room availability model', () => {
  it('allows adjacent bookings without treating boundaries as overlap', () => {
    expect(
      roomSlotOverlaps(
        new Date('2026-08-19T09:30:00+09:00'),
        new Date('2026-08-19T10:00:00+09:00'),
        occupancy
      )
    ).toBe(false);
    expect(
      roomSlotOverlaps(
        new Date('2026-08-19T11:00:00+09:00'),
        new Date('2026-08-19T11:30:00+09:00'),
        occupancy
      )
    ).toBe(false);
  });

  it('blocks a requested duration when any portion crosses an occupied interval', () => {
    expect(
      roomSlotAvailable({
        start: new Date('2026-08-19T09:30:00+09:00'),
        end: new Date('2026-08-19T10:30:00+09:00'),
        occupancy,
        active: true,
      })
    ).toBe(false);
  });

  it('never offers slots for rooms outside active service', () => {
    expect(
      roomSlotAvailable({
        start: new Date('2026-08-19T12:00:00+09:00'),
        end: new Date('2026-08-19T12:30:00+09:00'),
        occupancy,
        active: false,
      })
    ).toBe(false);
  });
});
