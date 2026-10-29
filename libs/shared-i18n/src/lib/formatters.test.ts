import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultRegionalPreference, writeRegionalPreference } from '@dwp-frontend/shared-utils';

import {
  formatDate,
  formatNumber,
  formatRelativeTime,
  resolveCanonicalTimeZone,
  resolveSystemTimeZone,
  resolveZonedClock,
  resolveZonedDateKey,
  resolveZonedDateTimeParts,
} from './formatters';

describe('locale-aware formatters', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  it('formats the same date according to the requested product locale', () => {
    const value = new Date('2026-01-02T00:00:00.000Z');
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    };

    expect(formatDate(value, options, 'en')).toBe('January 2, 2026');
    expect(formatDate(value, options, 'ko')).toBe('2026년 1월 2일');
  });

  it('resolves only canonical IANA time-zone identifiers', () => {
    expect(resolveCanonicalTimeZone('Asia/Seoul')).toBe('Asia/Seoul');
    expect(resolveCanonicalTimeZone('../Seoul')).toBeNull();
    expect(resolveCanonicalTimeZone(' Asia/Seoul ')).toBeNull();
  });

  it('uses locale plural and relative-time rules instead of string assembly', () => {
    expect(formatNumber(1234.5, undefined, 'en')).toBe('1,234.5');
    expect(formatRelativeTime(-1, 'day', undefined, 'en')).toBe('yesterday');
    expect(formatRelativeTime(-1, 'day', undefined, 'ko')).toBe('어제');
  });

  it('applies the persisted date, time-zone, clock, and number preferences', () => {
    writeRegionalPreference({
      ...defaultRegionalPreference,
      timeZone: 'UTC',
      dateFormat: 'iso',
      timeFormat: '24_hour',
      numberFormat: 'dot_decimal',
    });

    expect(
      formatDate('2026-08-12T09:30:00.000Z', { dateStyle: 'short', timeStyle: 'short' }, 'en')
    ).toBe('2026-08-12 09:30');
    expect(formatNumber(1234.5, undefined, 'en')).toBe('1.234,5');
  });

  it('lets an authoritative site time zone override the regional preference', () => {
    writeRegionalPreference({
      ...defaultRegionalPreference,
      timeZone: 'America/Los_Angeles',
    });

    expect(
      formatDate('2026-08-12T23:30:00.000Z', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }, 'en')
    ).toBe('Aug 13, 2026');
  });

  it('resolves an ISO weekday and local clock for policy evaluation', () => {
    expect(resolveZonedClock('2026-08-21T00:30:00.000Z', 'Asia/Seoul')).toEqual({
      day: 5,
      hour: 9,
      minute: 30,
    });
    expect(resolveZonedClock('2026-08-21T00:30:00.000Z', 'Invalid/TimeZone')).toBeNull();
  });

  it('resolves an ISO date key for the supplied IANA time zone', () => {
    expect(resolveZonedDateKey('2026-08-24T15:30:00.000Z', 'Asia/Seoul')).toBe('2026-08-25');
    expect(resolveZonedDateKey('2026-08-24T15:30:00.000Z', 'America/Los_Angeles')).toBe(
      '2026-08-24'
    );
    expect(resolveZonedDateKey('2026-08-24T15:30:00.000Z', 'Invalid/TimeZone')).toBeNull();
  });

  it('resolves complete wall-clock parts for zoned date-time inputs', () => {
    expect(resolveZonedDateTimeParts('2026-08-24T15:30:45.000Z', 'Asia/Seoul')).toEqual({
      year: '2026',
      month: '08',
      day: '25',
      hour: '00',
      minute: '30',
      second: '45',
    });
    expect(resolveZonedDateTimeParts('2026-08-24T15:30:45.000Z', 'Invalid/TimeZone')).toBeNull();
  });

  it('resolves the browser time zone while preserving each product fallback', () => {
    const resolvedOptions = Intl.DateTimeFormat().resolvedOptions();
    const resolvedOptionsSpy = vi
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ ...resolvedOptions, timeZone: '' });

    expect(resolveSystemTimeZone()).toBe('');
    expect(resolveSystemTimeZone('Asia/Seoul')).toBe('Asia/Seoul');
    expect(resolveSystemTimeZone('UTC')).toBe('UTC');

    resolvedOptionsSpy.mockReturnValue({ ...resolvedOptions, timeZone: 'America/Los_Angeles' });
    expect(resolveSystemTimeZone('Asia/Seoul')).toBe('America/Los_Angeles');
  });
});
