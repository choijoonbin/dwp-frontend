import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import type { Dayjs } from 'dayjs';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export type ProductDateLocale = 'en' | 'ko';

export type DateRangeValue = {
  start: string | null;
  end: string | null;
};

export function resolveProductDateLocale(locale: string | undefined): ProductDateLocale {
  return locale?.toLowerCase().split('-')[0] === 'ko' ? 'ko' : 'en';
}

export function isValidTimeZone(value: string | undefined): value is string {
  if (!value?.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function resolveProductTimeZone(...candidates: Array<string | null | undefined>): string {
  const configured = candidates.find((candidate) => isValidTimeZone(candidate ?? undefined));
  if (configured) return configured;
  const system = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(system) ? system : 'UTC';
}

export function parseDateOnly(value: string | null | undefined, timeZone: string): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs.tz(value, 'YYYY-MM-DD', timeZone);
  return parsed.isValid() && parsed.format('YYYY-MM-DD') === value ? parsed : null;
}

export function formatDateOnly(value: Dayjs | null): string | null {
  return value?.isValid() ? value.format('YYYY-MM-DD') : null;
}

export function parseUtcDateTime(value: string | null | undefined): Dayjs | null {
  if (!value) return null;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const parsed = dayjs(value).utc();
  return parsed.isValid() ? parsed : null;
}

export function toUtcIso(value: Dayjs | null): string | null {
  return value?.isValid() ? value.utc().toISOString() : null;
}

export function isOrderedDateRange(value: DateRangeValue): boolean {
  if (!value.start || !value.end) return true;
  return value.start <= value.end;
}

export { dayjs };
export type { Dayjs };
