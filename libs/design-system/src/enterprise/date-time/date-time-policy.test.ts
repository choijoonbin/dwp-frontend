import { describe, expect, it } from 'vitest';

import {
  dayjs,
  formatDateOnly,
  isOrderedDateRange,
  isValidTimeZone,
  parseDateOnly,
  parseUtcDateTime,
  resolveProductDateLocale,
  resolveProductTimeZone,
  toUtcIso,
} from './date-time-policy';

describe('date-time policy', () => {
  it('normalizes product locales and validates IANA time zones', () => {
    expect(resolveProductDateLocale('ko-KR')).toBe('ko');
    expect(resolveProductDateLocale('fr-FR')).toBe('en');
    expect(isValidTimeZone('Asia/Seoul')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(resolveProductTimeZone('Mars/Olympus', 'UTC')).toBe('UTC');
  });

  it('keeps date-only values calendar-safe in the requested time zone', () => {
    const value = parseDateOnly('2026-08-11', 'Asia/Seoul');
    expect(formatDateOnly(value)).toBe('2026-08-11');
    expect(parseDateOnly('2026-02-30', 'Asia/Seoul')).toBeNull();
  });

  it('stores instants as UTC ISO and renders them in an explicit zone', () => {
    const local = dayjs.tz('2026-08-11 09:30', 'Asia/Seoul');
    expect(toUtcIso(local)).toBe('2026-08-11T00:30:00.000Z');
    expect(parseUtcDateTime('2026-08-11T00:30:00.000Z')?.tz('Asia/Seoul').format('HH:mm')).toBe(
      '09:30'
    );
    expect(parseUtcDateTime('2026-08-11T09:30:00+09:00')?.toISOString()).toBe(
      '2026-08-11T00:30:00.000Z'
    );
    expect(parseUtcDateTime('2026-08-11T09:30:00')).toBeNull();
    expect(parseUtcDateTime('not-a-date')).toBeNull();
  });

  it('accepts open ranges and rejects reversed closed ranges', () => {
    expect(isOrderedDateRange({ start: '2026-08-11', end: null })).toBe(true);
    expect(isOrderedDateRange({ start: '2026-08-12', end: '2026-08-11' })).toBe(false);
  });
});
