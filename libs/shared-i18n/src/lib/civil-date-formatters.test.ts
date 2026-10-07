import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  defaultRegionalPreference,
  timeZoneOptions,
  writeRegionalPreference,
  type DateFormatPreference,
} from '@dwp-frontend/shared-utils/regional-preference';

import { formatCivilDate, formatDate, type CivilDateFormatOptions } from '..';

describe('civil DATE formatting through the public API', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it.each(timeZoneOptions)('preserves the date under the %s time-zone preference', (timeZone) => {
    writeRegionalPreference({ ...defaultRegionalPreference, timeZone });
    expect(formatCivilDate('2026-09-25', { dateStyle: 'long' }, 'en')).toBe('September 25, 2026');
    expect(formatCivilDate('2026-09-25', { dateStyle: 'long' }, 'ko')).toBe('2026년 9월 25일');
  });

  it.each([
    ['iso', '2026-09-25'],
    ['month_first', '09/25/2026'],
    ['day_first', '25/09/2026'],
  ] as const)(
    'honors the %s date-format preference without shifting the day',
    (dateFormat, expected) => {
      writeRegionalPreference({
        ...defaultRegionalPreference,
        timeZone: 'America/Los_Angeles',
        dateFormat: dateFormat as DateFormatPreference,
      });
      expect(formatCivilDate('2026-09-25', { dateStyle: 'long' }, 'en')).toBe(expected);
      expect(formatCivilDate('2026-09-25', { dateStyle: 'long' }, 'ko')).toBe(expected);
    }
  );

  it.each(['0001-01-01', '0099-12-31', '1900-02-28', '2000-02-29', '2024-02-29', '9999-12-31'])(
    'accepts a valid Gregorian date %s without the year-0-to-99 constructor shortcut',
    (value) => {
      writeRegionalPreference({ ...defaultRegionalPreference, dateFormat: 'iso' });
      expect(formatCivilDate(value)).toBe(value);
    }
  );

  it.each([
    '0000-01-01',
    '1900-02-29',
    '2025-02-29',
    '2026-02-31',
    '2026-00-25',
    '2026-13-25',
    '2026-09-00',
    '2026-09-32',
    '2026-9-25',
    ' 2026-09-25',
    '2026-09-25 ',
    '2026-09-25T00:00:00Z',
    '',
    null,
    20260925,
    new Date('2026-09-25'),
  ])('rejects invalid or instant-like input %# without echoing it', (value) => {
    expect(() => formatCivilDate(value as unknown as string)).toThrow(
      'Civil date must be a valid Gregorian YYYY-MM-DD value.'
    );
  });

  it.each([{ timeZone: 'America/Los_Angeles' }, { timeStyle: 'short' }, { hour: 'numeric' }])(
    'rejects time/zone options passed by an untyped caller %#',
    (options) => {
      expect(() => formatCivilDate('2026-09-25', options as CivilDateFormatOptions)).toThrow(
        'Civil date formatting does not accept time options.'
      );
    }
  );

  it('does not change regional time-zone conversion for real publication instants', () => {
    writeRegionalPreference({
      ...defaultRegionalPreference,
      timeZone: 'America/Los_Angeles',
      dateFormat: 'iso',
    });
    expect(formatCivilDate('2026-09-25')).toBe('2026-09-25');
    expect(formatDate('2026-08-25T00:00:00Z')).toBe('2026-08-24');
  });
});
