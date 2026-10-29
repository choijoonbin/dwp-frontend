import { Temporal } from 'temporal-polyfill';

import type {
  CalendarDayOfWeek,
  CalendarPolicy,
  CalendarRecurrence,
} from '@dwp-frontend/shared-utils';

export type RoomBookingRecurrenceError = 'invalid' | 'beforeStart' | 'window' | 'occurrences';

export type RoomBookingRecurrencePreview = Readonly<{
  dates: readonly string[];
  error: RoomBookingRecurrenceError | null;
}>;

const MAX_PREVIEW_OCCURRENCES = 4_000;
const DAY_BY_NUMBER: Readonly<Record<number, CalendarDayOfWeek>> = {
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
  7: 'SUNDAY',
};

function nextOccurrence(
  current: Temporal.ZonedDateTime,
  recurrence: Exclude<CalendarRecurrence, 'NONE'>,
  interval: number
) {
  if (recurrence === 'DAILY') return current.add({ days: interval });
  if (recurrence === 'WEEKLY') return current.add({ weeks: interval });
  if (recurrence === 'MONTHLY') return current.add({ months: interval });
  return current.add({ years: interval });
}

/** The room flow keeps recurrence bounded by UNTIL and emits the weekly anchor explicitly. */
export function roomBookingRecurrenceDays(
  recurrence: CalendarRecurrence,
  startsAt: string,
  timeZone: string,
  existingDays: readonly CalendarDayOfWeek[] = []
): CalendarDayOfWeek[] {
  if (recurrence !== 'WEEKLY') return [];
  try {
    const anchor =
      DAY_BY_NUMBER[Temporal.Instant.from(startsAt).toZonedDateTimeISO(timeZone).dayOfWeek];
    if (!anchor) return [];
    return Object.values(DAY_BY_NUMBER).filter(
      (day) => day === anchor || existingDays.includes(day)
    );
  } catch {
    return [];
  }
}

export function previewRoomBookingRecurrence(
  input: Readonly<{
    recurrence: CalendarRecurrence;
    interval: number;
    until: string;
    startsAt: string;
    timeZone: string;
    policy: CalendarPolicy;
    now?: string;
  }>
): RoomBookingRecurrencePreview {
  if (input.recurrence === 'NONE') return { dates: [], error: null };
  try {
    if (!Number.isInteger(input.interval) || input.interval < 1 || input.interval > 52) {
      return { dates: [], error: 'invalid' };
    }
    const until = Temporal.PlainDate.from(input.until);
    if (until.toString() !== input.until) return { dates: [], error: 'invalid' };
    const start = Temporal.Instant.from(input.startsAt).toZonedDateTimeISO(input.timeZone);
    const startDate = start.toPlainDate();
    if (Temporal.PlainDate.compare(until, startDate) < 0) {
      return { dates: [], error: 'beforeStart' };
    }
    const currentDate = (input.now ? Temporal.Instant.from(input.now) : Temporal.Now.instant())
      .toZonedDateTimeISO(input.timeZone)
      .toPlainDate();
    const lastAllowedDate = currentDate.add({ days: input.policy.maximumAdvanceDays });
    if (Temporal.PlainDate.compare(until, lastAllowedDate) > 0) {
      return { dates: [], error: 'window' };
    }
    const dates: string[] = [];
    let occurrence = start;
    while (Temporal.PlainDate.compare(occurrence.toPlainDate(), until) <= 0) {
      if (dates.length >= MAX_PREVIEW_OCCURRENCES) {
        return { dates: [], error: 'occurrences' };
      }
      dates.push(occurrence.toPlainDate().toString());
      occurrence = nextOccurrence(occurrence, input.recurrence, input.interval);
    }
    return dates.length >= 2 ? { dates, error: null } : { dates, error: 'occurrences' };
  } catch {
    return { dates: [], error: 'invalid' };
  }
}
