import { beforeEach, describe, expect, it } from 'vitest';
import { defaultRegionalPreference, writeRegionalPreference } from '@dwp-frontend/shared-utils';

import { formatDate, formatNumber, formatRelativeTime } from './formatters';

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
});
