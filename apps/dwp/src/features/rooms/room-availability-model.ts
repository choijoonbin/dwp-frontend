import { Temporal } from 'temporal-polyfill';

import type { CalendarPolicy } from '@dwp-frontend/shared-utils';

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
