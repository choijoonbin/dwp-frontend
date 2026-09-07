import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import { readRegionalPreference } from '@dwp-frontend/shared-utils';
import { Temporal } from 'temporal-polyfill';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export function calendarRegionalTimeZone() {
  const preference = readRegionalPreference().timeZone;
  return calendarResolvedTimeZone(preference);
}

export function calendarResolvedTimeZone(preference: string, systemTimeZone?: string) {
  return preference === 'system'
    ? (systemTimeZone ?? resolveSystemTimeZone('Asia/Seoul'))
    : preference;
}

export function calendarDisplayDateValue(
  value: string | Date,
  timeZone = calendarRegionalTimeZone()
) {
  if (typeof value !== 'string' || !LOCAL_DATE.test(value)) return value;
  try {
    return new Date(
      Number(Temporal.ZonedDateTime.from(`${value}T12:00:00[${timeZone}]`).epochMilliseconds)
    );
  } catch {
    return value;
  }
}
