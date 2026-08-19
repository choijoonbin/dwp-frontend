import type { RoomOccupancy } from '@dwp-frontend/shared-utils';

export function roomSlotOverlaps(
  start: Date,
  end: Date,
  occupancy: readonly RoomOccupancy[]
): boolean {
  return occupancy.some(
    (busy) => Date.parse(busy.startsAt) < end.getTime() && Date.parse(busy.endsAt) > start.getTime()
  );
}

export function roomSlotAvailable({
  start,
  end,
  occupancy,
  active,
}: {
  start: Date;
  end: Date;
  occupancy: readonly RoomOccupancy[];
  active: boolean;
}): boolean {
  return active && end > start && !roomSlotOverlaps(start, end, occupancy);
}
