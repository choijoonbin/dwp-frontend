import { getCurrentLanguage } from './i18n';
import { readRegionalPreference } from '@dwp-frontend/shared-utils';

type DateValue = Date | number | string;

const ISO_WEEKDAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export type ZonedClock = {
  day: number;
  hour: number;
  minute: number;
};

export type ZonedDateKey = string;

function asDate(value: DateValue): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale = getCurrentLanguage()
): string {
  const preference = readRegionalPreference();
  const timeZone = preference.timeZone === 'system' ? undefined : preference.timeZone;
  const hour12 =
    preference.timeFormat === 'locale' ? undefined : preference.timeFormat === '12_hour';
  const effectiveOptions: Intl.DateTimeFormatOptions = {
    ...options,
    ...(timeZone ? { timeZone } : {}),
    ...(hour12 === undefined ? {} : { hour12 }),
  };

  if (preference.dateFormat === 'locale' || !options.dateStyle) {
    return new Intl.DateTimeFormat(locale, effectiveOptions).format(asDate(value));
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(asDate(value));
  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const year = valueOf('year');
  const month = valueOf('month');
  const day = valueOf('day');
  const dateText =
    preference.dateFormat === 'iso'
      ? `${year}-${month}-${day}`
      : preference.dateFormat === 'month_first'
        ? `${month}/${day}/${year}`
        : `${day}/${month}/${year}`;

  if (!options.timeStyle) return dateText;
  const timeText = new Intl.DateTimeFormat(locale, {
    timeStyle: options.timeStyle,
    ...(timeZone ? { timeZone } : {}),
    ...(hour12 === undefined ? {} : { hour12 }),
  }).format(asDate(value));
  return `${dateText} ${timeText}`;
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale = getCurrentLanguage()
): string {
  const preference = readRegionalPreference();
  const numberLocale =
    preference.numberFormat === 'comma_decimal'
      ? 'en-US'
      : preference.numberFormat === 'dot_decimal'
        ? 'de-DE'
        : preference.numberFormat === 'space_decimal'
          ? 'fr-FR'
          : locale;
  return new Intl.NumberFormat(numberLocale, options).format(value);
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
  locale = getCurrentLanguage()
): string {
  return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
}

export function formatList(
  values: string[],
  options?: Intl.ListFormatOptions,
  locale = getCurrentLanguage()
): string {
  return new Intl.ListFormat(locale, options).format(values);
}

export function resolveZonedClock(value: DateValue, timeZone: string): ZonedClock | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(asDate(value));
    const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    const day = ISO_WEEKDAY[valueOf('weekday') ?? ''];
    const hour = Number(valueOf('hour'));
    const minute = Number(valueOf('minute'));
    if (!day || !Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    return { day, hour, minute };
  } catch {
    return null;
  }
}

export function resolveZonedDateKey(value: DateValue, timeZone: string): ZonedDateKey | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(asDate(value));
    const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    const year = valueOf('year');
    const month = valueOf('month');
    const day = valueOf('day');
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
}
