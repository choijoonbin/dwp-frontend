import { Temporal } from 'temporal-polyfill';

import type { CalendarPolicy, RoomOccupancy } from '@dwp-frontend/shared-utils';

export const DEFAULT_ROOM_POLICY: CalendarPolicy = {
  weekStart: 1,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 15,
  maximumEventMinutes: 480,
  maximumAdvanceDays: 180,
  defaultBufferMinutes: 0,
  weeklyFocusTargetMinutes: 240,
  dailyMeetingLimitMinutes: 480,
  enforceMeetingAgenda: false,
  allowExternalAttendees: false,
  version: 0,
};

export type RoomBookingRangeError = 'invalid' | 'past' | 'window' | 'duration' | 'hours';

export type RoomPolicySlot = {
  startsAt: string;
  endsAt: string;
  localTime: string;
};

function clockMinutes(value: string) {
  const [hour = 0, minute = 0] = value.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function clock(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function localInstant(date: string, time: string, timeZone: string) {
  return Temporal.ZonedDateTime.from(`${date}T${time}:00[${timeZone}]`, {
    disambiguation: 'reject',
  }).toInstant();
}

export function roomAvailabilityRange(date: string) {
  const utcStart = Temporal.Instant.from(`${date}T00:00:00Z`);
  return {
    from: utcStart.subtract({ hours: 14 }).toString(),
    to: utcStart.add({ hours: 36 }).toString(),
  };
}

export function roomLocalDate(timeZone: string, now = Temporal.Now.instant().toString()) {
  return Temporal.Instant.from(now).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

export function roomDateBounds(
  timeZone: string,
  maximumAdvanceDays: number,
  now = Temporal.Now.instant().toString()
) {
  const today = Temporal.Instant.from(now).toZonedDateTimeISO(timeZone).toPlainDate();
  return {
    minDate: today.toString(),
    maxDate: today.add({ days: maximumAdvanceDays }).toString(),
  };
}

export function roomDurationOptions(policy: CalendarPolicy) {
  return [
    policy.defaultEventMinutes,
    policy.minimumEventMinutes,
    30,
    60,
    90,
    120,
    policy.maximumEventMinutes,
  ]
    .filter(
      (value, index, values) =>
        value >= policy.minimumEventMinutes &&
        value <= policy.maximumEventMinutes &&
        values.indexOf(value) === index
    )
    .sort((left, right) => left - right);
}

export function roomPolicySlots(
  date: string,
  timeZone: string,
  durationMinutes: number,
  policy: CalendarPolicy,
  slotMinutes = 30
): RoomPolicySlot[] {
  const start = clockMinutes(policy.workingDayStart);
  const end = clockMinutes(policy.workingDayEnd);
  const result: RoomPolicySlot[] = [];
  for (let current = start; current + durationMinutes <= end; current += slotMinutes) {
    const localTime = clock(current);
    try {
      const instant = localInstant(date, localTime, timeZone);
      result.push({
        startsAt: instant.toString(),
        endsAt: instant.add({ minutes: durationMinutes }).toString(),
        localTime,
      });
    } catch {
      // A DST transition can remove a local wall-clock slot.
    }
  }
  return result;
}

export function roomDefaultRange(
  timeZone: string,
  policy: CalendarPolicy,
  now = Temporal.Now.instant().toString()
) {
  const localNow = Temporal.Instant.from(now).toZonedDateTimeISO(timeZone);
  const workingStart = clockMinutes(policy.workingDayStart);
  const duration = Math.min(
    Math.max(policy.defaultEventMinutes, policy.minimumEventMinutes),
    policy.maximumEventMinutes
  );
  const latestStart = clockMinutes(policy.workingDayEnd) - duration;
  const currentMinutes = localNow.hour * 60 + localNow.minute;
  let date = localNow.toPlainDate();
  let startMinutes = Math.ceil((currentMinutes + 1) / 30) * 30;
  if (currentMinutes < workingStart) startMinutes = workingStart;
  else if (startMinutes > latestStart) {
    date = date.add({ days: 1 });
    startMinutes = workingStart;
  }
  const startsAt = localInstant(date.toString(), clock(startMinutes), timeZone);
  return {
    startsAt: startsAt.toString(),
    endsAt: startsAt.add({ minutes: duration }).toString(),
  };
}

export function validateRoomBookingRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
  policy: CalendarPolicy,
  now = Temporal.Now.instant().toString()
): RoomBookingRangeError | null {
  try {
    const start = Temporal.Instant.from(startsAt);
    const end = Temporal.Instant.from(endsAt);
    const current = Temporal.Instant.from(now);
    if (Temporal.Instant.compare(end, start) <= 0) return 'invalid';
    if (Temporal.Instant.compare(start, current) < 0) return 'past';
    const localStart = start.toZonedDateTimeISO(timeZone);
    const localCurrent = current.toZonedDateTimeISO(timeZone);
    if (
      Temporal.PlainDate.compare(
        localStart.toPlainDate(),
        localCurrent.toPlainDate().add({ days: policy.maximumAdvanceDays })
      ) > 0
    )
      return 'window';
    const durationMinutes = Number((end.epochMilliseconds - start.epochMilliseconds) / 60_000);
    if (
      durationMinutes < policy.minimumEventMinutes ||
      durationMinutes > policy.maximumEventMinutes
    ) {
      return 'duration';
    }
    const localEnd = end.toZonedDateTimeISO(timeZone);
    const sameDay = localStart.toPlainDate().equals(localEnd.toPlainDate());
    const inHours =
      Temporal.PlainTime.compare(
        localStart.toPlainTime(),
        Temporal.PlainTime.from(policy.workingDayStart)
      ) >= 0 &&
      Temporal.PlainTime.compare(
        localEnd.toPlainTime(),
        Temporal.PlainTime.from(policy.workingDayEnd)
      ) <= 0;
    return sameDay && inHours ? null : 'hours';
  } catch {
    return 'invalid';
  }
}

export function roomSlotOverlaps(
  start: Date,
  end: Date,
  occupancy: readonly RoomOccupancy[],
  bufferMinutes = 0
): boolean {
  const bufferMilliseconds = Math.max(0, bufferMinutes) * 60_000;
  return occupancy.some(
    (busy) =>
      Date.parse(busy.startsAt) < end.getTime() + bufferMilliseconds &&
      Date.parse(busy.endsAt) > start.getTime() - bufferMilliseconds
  );
}

export function roomSlotAvailable({
  start,
  end,
  occupancy,
  active,
  bufferMinutes = 0,
}: {
  start: Date;
  end: Date;
  occupancy: readonly RoomOccupancy[];
  active: boolean;
  bufferMinutes?: number;
}): boolean {
  return active && end > start && !roomSlotOverlaps(start, end, occupancy, bufferMinutes);
}
