import { Temporal } from 'temporal-polyfill';

import type { WorkplacePolicy } from '@dwp-frontend/shared-utils';

export type WorkplaceBookingRangeError =
  | 'invalid'
  | 'past'
  | 'window'
  | 'duration'
  | 'hours';

function minutes(value: string) {
  const [hour = 0, minute = 0] = value.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function clock(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function workplaceRange(
  date: string,
  time: string,
  durationMinutes: number,
  timeZone: string
) {
  const start = Temporal.ZonedDateTime.from(`${date}T${time}:00[${timeZone}]`, {
    disambiguation: 'reject',
  });
  return {
    from: start.toInstant().toString(),
    to: start.add({ minutes: durationMinutes }).toInstant().toString(),
  };
}

export function workplaceDateBounds(
  timeZone: string,
  bookingWindowDays: number,
  now = Temporal.Now.instant().toString()
) {
  const today = Temporal.Instant.from(now).toZonedDateTimeISO(timeZone).toPlainDate();
  return {
    minDate: today.toString(),
    maxDate: today.add({ days: bookingWindowDays }).toString(),
  };
}

export function workplaceDefaultSelection(
  timeZone: string,
  policy: WorkplacePolicy,
  now = Temporal.Now.instant().toString()
) {
  const localNow = Temporal.Instant.from(now).toZonedDateTimeISO(timeZone);
  const workingStart = minutes(policy.workingDayStart);
  const latestStart = minutes(policy.workingDayEnd) - policy.minimumBookingMinutes;
  const currentMinutes = localNow.hour * 60 + localNow.minute;
  let date = localNow.toPlainDate();
  let startMinutes = Math.ceil((currentMinutes + 1) / 30) * 30;
  if (currentMinutes < workingStart) {
    startMinutes = workingStart;
  } else if (startMinutes > latestStart) {
    date = date.add({ days: 1 });
    startMinutes = workingStart;
  }
  return { date: date.toString(), time: clock(startMinutes) };
}

export function workplaceTimeOptions(
  workingDayStart: string,
  workingDayEnd: string,
  minimumBookingMinutes: number
) {
  const start = minutes(workingDayStart);
  const latestStart = minutes(workingDayEnd) - minimumBookingMinutes;
  const values: Array<{ value: string; label: string }> = [];
  for (let current = start; current <= latestStart; current += 30) {
    const value = clock(current);
    values.push({ value, label: value });
  }
  return values;
}

export function workplaceDurationOptions(policy: WorkplacePolicy) {
  const workingMinutes = minutes(policy.workingDayEnd) - minutes(policy.workingDayStart);
  const maximum = Math.min(policy.maximumBookingMinutes, workingMinutes);
  return [
    policy.minimumBookingMinutes,
    15,
    30,
    45,
    60,
    90,
    120,
    240,
    480,
    maximum,
  ]
    .filter((value, index, values) =>
      value >= policy.minimumBookingMinutes &&
      value <= maximum &&
      values.indexOf(value) === index
    )
    .sort((left, right) => left - right);
}

export function validateWorkplaceBookingRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
  policy: WorkplacePolicy,
  now = Temporal.Now.instant().toString()
): WorkplaceBookingRangeError | null {
  try {
    const start = Temporal.Instant.from(startsAt);
    const end = Temporal.Instant.from(endsAt);
    const current = Temporal.Instant.from(now);
    if (Temporal.Instant.compare(end, start) <= 0) return 'invalid';
    if (Temporal.Instant.compare(start, current) < 0) return 'past';
    const windowEnd = Temporal.Instant.fromEpochMilliseconds(
      current.epochMilliseconds + policy.bookingWindowDays * 86_400_000
    );
    if (Temporal.Instant.compare(start, windowEnd) > 0) return 'window';
    const duration = Number((end.epochMilliseconds - start.epochMilliseconds) / 60_000);
    if (duration < policy.minimumBookingMinutes || duration > policy.maximumBookingMinutes) {
      return 'duration';
    }
    const localStart = start.toZonedDateTimeISO(timeZone);
    const localEnd = end.toZonedDateTimeISO(timeZone);
    const sameDay = localStart.toPlainDate().equals(localEnd.toPlainDate());
    const startsInHours = Temporal.PlainTime.compare(
      localStart.toPlainTime(),
      Temporal.PlainTime.from(policy.workingDayStart)
    ) >= 0;
    const endsInHours = Temporal.PlainTime.compare(
      localEnd.toPlainTime(),
      Temporal.PlainTime.from(policy.workingDayEnd)
    ) <= 0;
    return sameDay && startsInHours && endsInHours ? null : 'hours';
  } catch {
    return 'invalid';
  }
}
