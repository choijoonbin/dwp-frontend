import { getCurrentLanguage } from './i18n';

type DateValue = Date | number | string;

function asDate(value: DateValue): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale = getCurrentLanguage()
): string {
  return new Intl.DateTimeFormat(locale, options).format(asDate(value));
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale = getCurrentLanguage()
): string {
  return new Intl.NumberFormat(locale, options).format(value);
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
