import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import type { Dayjs } from 'dayjs';

export {
  isValidTimeZone,
  resolveProductDateLocale,
  resolveProductTimeZone,
} from './date-time-policy-resolution';
export type { ProductDateLocale } from './date-time-policy-resolution';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export type DateRangeValue = {
  start: string | null;
  end: string | null;
};

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

/** A civil editor value has no offset; UTC is only its lossless picker display frame. */
export function civilDateTimeToPickerIso(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = dayjs.utc(value, 'YYYY-MM-DDTHH:mm', true);
  return parsed.isValid() ? parsed.toISOString() : null;
}

export function pickerIsoToCivilDateTime(value: string | null | undefined): string | null {
  return parseUtcDateTime(value)?.format('YYYY-MM-DDTHH:mm') ?? null;
}

export function isOrderedDateRange(value: DateRangeValue): boolean {
  if (!value.start || !value.end) return true;
  return value.start <= value.end;
}

export { dayjs };
export type { Dayjs };
