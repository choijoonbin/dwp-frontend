import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import {
  getCalendarSettings,
  type CalendarAvailabilitySlot,
  type CalendarDayOfWeek,
  type CalendarSettings,
} from '@dwp-frontend/shared-utils';
import { Temporal } from 'temporal-polyfill';

import { calendarRegionalTimeZone } from './calendar-regional-time';

export const CALENDAR_SETTINGS_QUERY_KEY = ['calendar', 'settings'] as const;

const CALENDAR_DAYS: readonly CalendarDayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];
const DEFAULT_WORKING_DAYS = CALENDAR_DAYS.slice(0, 5);
const DAY_NUMBER: Readonly<Record<CalendarDayOfWeek, number>> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export type CalendarPreferenceFallback = Readonly<{
  workingDays?: readonly CalendarDayOfWeek[];
  workingDayStart?: string | null;
  workingDayEnd?: string | null;
  timeZone?: string | null;
  weekStart?: CalendarDayOfWeek | number | null;
}>;

export type CalendarEffectivePreferences = Readonly<{
  workingDays: readonly CalendarDayOfWeek[];
  workingDayNumbers: readonly number[];
  workingDayStart: string | null;
  workingDayEnd: string | null;
  timeZone: string;
  weekStart: CalendarDayOfWeek;
  weekStartNumber: number;
  workingScheduleSource: 'SETTINGS' | 'FALLBACK';
}>;

function calendarDay(value: unknown): value is CalendarDayOfWeek {
  return typeof value === 'string' && CALENDAR_DAYS.includes(value as CalendarDayOfWeek);
}

function calendarDays(value: unknown): CalendarDayOfWeek[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every(calendarDay)) return null;
  return [...new Set(value)];
}

function calendarTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/u.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? `${match[1]}:${match[2]}` : null;
}

function calendarWorkingHours(start: unknown, end: unknown) {
  const normalizedStart = calendarTime(start);
  const normalizedEnd = calendarTime(end);
  return normalizedStart && normalizedEnd && normalizedStart < normalizedEnd
    ? { start: normalizedStart, end: normalizedEnd }
    : null;
}

function calendarTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(value);
    return value;
  } catch {
    return null;
  }
}

function calendarWeekStart(value: unknown): CalendarDayOfWeek | null {
  if (calendarDay(value)) return value;
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  const normalized = ((value % 7) + 7) % 7;
  return CALENDAR_DAYS.find((day) => DAY_NUMBER[day] === normalized) ?? null;
}

export function calendarEffectivePreferences(
  settings: CalendarSettings | undefined,
  fallback: CalendarPreferenceFallback = {}
): CalendarEffectivePreferences {
  // The settings endpoint returns the effective, governed value. Consuming that value as a
  // single authority keeps locked tenant-policy fields out of local/draft recomposition.
  const settingsDays = calendarDays(settings?.workingDays);
  const settingsHours = calendarWorkingHours(settings?.workingDayStart, settings?.workingDayEnd);
  const fallbackDays = calendarDays(fallback.workingDays);
  const fallbackHours = calendarWorkingHours(fallback.workingDayStart, fallback.workingDayEnd);
  const workingDays = settingsDays ?? fallbackDays ?? [...DEFAULT_WORKING_DAYS];
  const workingHours = settingsHours ?? fallbackHours;
  const settingsTimeZone = calendarTimeZone(settings?.timeZone);
  const timeZone =
    settingsTimeZone ?? calendarTimeZone(fallback.timeZone) ?? resolveSystemTimeZone('Asia/Seoul');
  const weekStart =
    calendarWeekStart(settings?.weekStart) ?? calendarWeekStart(fallback.weekStart) ?? 'MONDAY';

  return {
    workingDays,
    workingDayNumbers: workingDays.map((day) => DAY_NUMBER[day]),
    workingDayStart: workingHours?.start ?? null,
    workingDayEnd: workingHours?.end ?? null,
    timeZone,
    weekStart,
    weekStartNumber: DAY_NUMBER[weekStart],
    workingScheduleSource:
      settingsDays && settingsHours && settingsTimeZone ? 'SETTINGS' : 'FALLBACK',
  };
}

export function calendarSlotMatchesWorkingSchedule(
  slot: Pick<CalendarAvailabilitySlot, 'startsAt' | 'endsAt'>,
  preferences: CalendarEffectivePreferences
) {
  if (
    preferences.workingScheduleSource !== 'SETTINGS' ||
    !preferences.workingDayStart ||
    !preferences.workingDayEnd
  ) {
    return true;
  }

  try {
    const startsAt = Temporal.Instant.from(slot.startsAt).toZonedDateTimeISO(preferences.timeZone);
    const endsAt = Temporal.Instant.from(slot.endsAt).toZonedDateTimeISO(preferences.timeZone);
    if (Temporal.ZonedDateTime.compare(endsAt, startsAt) <= 0) return false;
    if (!startsAt.toPlainDate().equals(endsAt.toPlainDate())) return false;
    const day = CALENDAR_DAYS[startsAt.dayOfWeek - 1];
    const start = startsAt.toPlainTime().toString().slice(0, 5);
    const end = endsAt.toPlainTime().toString().slice(0, 5);
    return Boolean(
      day &&
      preferences.workingDays.includes(day) &&
      start >= preferences.workingDayStart &&
      end <= preferences.workingDayEnd
    );
  } catch {
    return false;
  }
}

export function useCalendarEffectivePreferences(fallback: CalendarPreferenceFallback = {}) {
  const [regionalTimeZone, setRegionalTimeZone] = useState(calendarRegionalTimeZone);
  useEffect(() => {
    const syncPreference = () => setRegionalTimeZone(calendarRegionalTimeZone());
    window.addEventListener('dwp:regional-preference-change', syncPreference);
    return () => window.removeEventListener('dwp:regional-preference-change', syncPreference);
  }, []);

  const query = useQuery({
    queryKey: CALENDAR_SETTINGS_QUERY_KEY,
    queryFn: ({ signal }) => getCalendarSettings(signal),
    staleTime: 60_000,
    retry: 1,
  });
  const preferences = calendarEffectivePreferences(query.data, {
    ...fallback,
    timeZone: fallback.timeZone ?? regionalTimeZone,
  });

  return { preferences, query };
}
