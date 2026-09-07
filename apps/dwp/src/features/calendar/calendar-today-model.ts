import { resolveZonedClock } from '@dwp-frontend/shared-i18n';
import { Temporal } from 'temporal-polyfill';

import type { CalendarEvent } from '@dwp-frontend/shared-utils';

export type CalendarTodayEventPhase = 'ELAPSED' | 'CURRENT' | 'UPCOMING';

export type CalendarTodayStreamItem =
  | Readonly<{
      kind: 'event';
      event: CalendarEvent;
      phase: CalendarTodayEventPhase;
    }>
  | Readonly<{
      kind: 'open-window';
      startsAt: string;
      endsAt: string;
      durationMinutes: number;
      boundary: 'NEXT_EVENT' | 'WORKDAY_END';
    }>;

export type CalendarTodayMetrics = Readonly<{
  eventCount: number;
  meetingMinutes: number;
  focusMinutes: number;
}>;

export type CalendarWorkdayPhase = 'BEFORE' | 'ACTIVE' | 'AFTER' | 'UNKNOWN';

export type CalendarTodayStreamOptions = Readonly<{
  minimumOpenMinutes?: number;
  date?: string;
  timeZone?: string;
  workingDayStart?: string | null;
  workingDayEnd?: string | null;
}>;

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function visibleTodayEvents(events: readonly CalendarEvent[]) {
  return events
    .filter((event) => event.status !== 'CANCELLED')
    .filter((event) => timestamp(event.startsAt) !== null && timestamp(event.endsAt) !== null)
    .sort((left, right) => {
      const starts = Date.parse(left.startsAt) - Date.parse(right.startsAt);
      return starts || left.eventId.localeCompare(right.eventId);
    });
}

function zonedDayBounds(date: string, timeZone: string) {
  try {
    const start = Temporal.ZonedDateTime.from(`${date}T00:00:00[${timeZone}]`);
    return {
      start: Number(start.epochMilliseconds),
      end: Number(start.add({ days: 1 }).epochMilliseconds),
    };
  } catch {
    return null;
  }
}

function zonedWorkingTime(date: string, timeZone: string, value?: string | null) {
  if (!value || !/^\d{2}:\d{2}(?::\d{2})?$/u.test(value)) return null;
  try {
    return Number(Temporal.ZonedDateTime.from(`${date}T${value}[${timeZone}]`).epochMilliseconds);
  } catch {
    return null;
  }
}

export function calendarWorkdayPhase(
  generatedAt: string,
  options: Readonly<{
    date?: string;
    timeZone?: string;
    workingDayStart?: string | null;
    workingDayEnd?: string | null;
  }>
): CalendarWorkdayPhase {
  const now = timestamp(generatedAt);
  if (now === null || !options.date || !options.timeZone) return 'UNKNOWN';
  const start = zonedWorkingTime(options.date, options.timeZone, options.workingDayStart);
  const end = zonedWorkingTime(options.date, options.timeZone, options.workingDayEnd);
  if (start === null || end === null || end <= start) return 'UNKNOWN';
  if (now < start) return 'BEFORE';
  if (now >= end) return 'AFTER';
  return 'ACTIVE';
}

export function calendarHomeSnapshotIsFresh(
  generatedAt: string,
  now: string | number | Date = Date.now(),
  maximumAgeMs = 120_000
) {
  const generated = timestamp(generatedAt);
  const current =
    now instanceof Date ? now.getTime() : typeof now === 'number' ? now : timestamp(now);
  if (generated === null || current === null) return false;
  const age = current - generated;
  return age >= -60_000 && age <= Math.max(0, maximumAgeMs);
}

export function calendarTodayMetrics(
  events: readonly CalendarEvent[],
  date: string,
  timeZone: string
): CalendarTodayMetrics {
  const bounds = zonedDayBounds(date, timeZone);
  if (!bounds) return { eventCount: 0, meetingMinutes: 0, focusMinutes: 0 };

  return visibleTodayEvents(events).reduce<CalendarTodayMetrics>(
    (metrics, event) => {
      const startsAt = Math.max(bounds.start, Date.parse(event.startsAt));
      const endsAt = Math.min(bounds.end, Date.parse(event.endsAt));
      if (endsAt <= startsAt) return metrics;
      const durationMinutes = Math.round((endsAt - startsAt) / 60_000);
      return {
        eventCount: metrics.eventCount + 1,
        meetingMinutes: metrics.meetingMinutes + (event.type === 'MEETING' ? durationMinutes : 0),
        focusMinutes: metrics.focusMinutes + (event.type === 'FOCUS' ? durationMinutes : 0),
      };
    },
    { eventCount: 0, meetingMinutes: 0, focusMinutes: 0 }
  );
}

export function calendarTodayStream(
  events: readonly CalendarEvent[],
  generatedAt: string,
  options: CalendarTodayStreamOptions = {}
): CalendarTodayStreamItem[] {
  const now = timestamp(generatedAt) ?? Date.now();
  const minimumGap = Math.max(1, options.minimumOpenMinutes ?? 30) * 60_000;
  const items: CalendarTodayStreamItem[] = [];
  const workingDayStart =
    options.date && options.timeZone
      ? zonedWorkingTime(options.date, options.timeZone, options.workingDayStart)
      : null;
  const workingDayEnd =
    options.date && options.timeZone
      ? zonedWorkingTime(options.date, options.timeZone, options.workingDayEnd)
      : null;
  let availableFrom = Math.max(now, workingDayStart ?? now);

  visibleTodayEvents(events).forEach((event) => {
    const startsAt = Date.parse(event.startsAt);
    const endsAt = Date.parse(event.endsAt);
    const openUntil = Math.min(startsAt, workingDayEnd ?? startsAt);

    if (endsAt > now && openUntil - availableFrom >= minimumGap) {
      items.push({
        kind: 'open-window',
        startsAt: new Date(availableFrom).toISOString(),
        endsAt: new Date(openUntil).toISOString(),
        durationMinutes: Math.round((openUntil - availableFrom) / 60_000),
        boundary:
          workingDayEnd !== null && openUntil === workingDayEnd ? 'WORKDAY_END' : 'NEXT_EVENT',
      });
    }

    items.push({
      kind: 'event',
      event,
      phase: endsAt <= now ? 'ELAPSED' : startsAt <= now ? 'CURRENT' : 'UPCOMING',
    });
    availableFrom = Math.max(availableFrom, endsAt);
  });

  if (workingDayEnd !== null && workingDayEnd - availableFrom >= minimumGap) {
    items.push({
      kind: 'open-window',
      startsAt: new Date(availableFrom).toISOString(),
      endsAt: new Date(workingDayEnd).toISOString(),
      durationMinutes: Math.round((workingDayEnd - availableFrom) / 60_000),
      boundary: 'WORKDAY_END',
    });
  }

  return items;
}

export function calendarTodayLeadEvent(
  events: readonly CalendarEvent[],
  generatedAt: string
): CalendarEvent | null {
  const now = timestamp(generatedAt) ?? Date.now();
  return (
    visibleTodayEvents(events).find((event) => {
      const endsAt = Date.parse(event.endsAt);
      return endsAt > now;
    }) ?? null
  );
}

export function calendarTodayHasCurrentEvent(
  events: readonly CalendarEvent[],
  generatedAt: string
) {
  const now = timestamp(generatedAt);
  if (now === null) return false;
  return visibleTodayEvents(events).some((event) => {
    const startsAt = Date.parse(event.startsAt);
    const endsAt = Date.parse(event.endsAt);
    return startsAt <= now && now < endsAt;
  });
}

export function calendarMinutesUntil(event: CalendarEvent, generatedAt: string) {
  const now = timestamp(generatedAt) ?? Date.now();
  return Math.max(0, Math.ceil((Date.parse(event.startsAt) - now) / 60_000));
}

export function calendarEventCanJoin(
  event: CalendarEvent,
  generatedAt: string,
  earlyJoinMinutes = 10
) {
  if (!calendarConferenceUrl(event) || event.type !== 'MEETING' || event.status === 'CANCELLED')
    return false;
  const now = timestamp(generatedAt);
  const startsAt = timestamp(event.startsAt);
  const endsAt = timestamp(event.endsAt);
  if (now === null || startsAt === null || endsAt === null || endsAt <= startsAt) return false;
  const joinableAt = startsAt - Math.max(0, earlyJoinMinutes) * 60_000;
  return now >= joinableAt && now < endsAt;
}

export function calendarConferenceUrl(event: CalendarEvent): string | null {
  if (!event.conferenceUrl || event.redacted || event.detailLevel === 'FREE_BUSY') return null;
  try {
    const url = new URL(event.conferenceUrl);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function calendarGreetingPeriod(generatedAt: string, timeZone: string) {
  const date = timestamp(generatedAt) === null ? new Date() : new Date(generatedAt);
  const hour = resolveZonedClock(date, timeZone)?.hour ?? date.getHours();
  if (hour < 12) return 'morning' as const;
  if (hour < 18) return 'afternoon' as const;
  return 'evening' as const;
}
