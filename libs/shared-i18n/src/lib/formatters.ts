import { getCurrentLanguage } from './i18n';
import { readRegionalPreference } from '@dwp-frontend/shared-utils';

type DateValue = Date | number | string;

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
