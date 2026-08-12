export const timeZoneOptions = [
  'system',
  'UTC',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
] as const;
export const dateFormatOptions = ['locale', 'iso', 'month_first', 'day_first'] as const;
export const timeFormatOptions = ['locale', '12_hour', '24_hour'] as const;
export const firstDayOfWeekOptions = ['locale', 'monday', 'sunday'] as const;
export const numberFormatOptions = [
  'locale',
  'comma_decimal',
  'dot_decimal',
  'space_decimal',
] as const;

export type TimeZonePreference = (typeof timeZoneOptions)[number];
export type DateFormatPreference = (typeof dateFormatOptions)[number];
export type TimeFormatPreference = (typeof timeFormatOptions)[number];
export type FirstDayOfWeekPreference = (typeof firstDayOfWeekOptions)[number];
export type NumberFormatPreference = (typeof numberFormatOptions)[number];

export type RegionalPreference = {
  timeZone: TimeZonePreference;
  dateFormat: DateFormatPreference;
  timeFormat: TimeFormatPreference;
  firstDayOfWeek: FirstDayOfWeekPreference;
  numberFormat: NumberFormatPreference;
};

export const defaultRegionalPreference: RegionalPreference = {
  timeZone: 'system',
  dateFormat: 'locale',
  timeFormat: 'locale',
  firstDayOfWeek: 'locale',
  numberFormat: 'locale',
};

const STORAGE_KEY = 'dwp.regional.v2';

function isOption<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

export function normalizeRegionalPreference(value: unknown): RegionalPreference {
  const candidate =
    value && typeof value === 'object' ? (value as Partial<RegionalPreference>) : {};
  return {
    timeZone: isOption(timeZoneOptions, candidate.timeZone)
      ? candidate.timeZone
      : defaultRegionalPreference.timeZone,
    dateFormat: isOption(dateFormatOptions, candidate.dateFormat)
      ? candidate.dateFormat
      : defaultRegionalPreference.dateFormat,
    timeFormat: isOption(timeFormatOptions, candidate.timeFormat)
      ? candidate.timeFormat
      : defaultRegionalPreference.timeFormat,
    firstDayOfWeek: isOption(firstDayOfWeekOptions, candidate.firstDayOfWeek)
      ? candidate.firstDayOfWeek
      : defaultRegionalPreference.firstDayOfWeek,
    numberFormat: isOption(numberFormatOptions, candidate.numberFormat)
      ? candidate.numberFormat
      : defaultRegionalPreference.numberFormat,
  };
}

export function readRegionalPreference(): RegionalPreference {
  if (typeof window === 'undefined') return defaultRegionalPreference;
  try {
    return normalizeRegionalPreference(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    );
  } catch {
    return defaultRegionalPreference;
  }
}

export function writeRegionalPreference(value: RegionalPreference): RegionalPreference {
  const normalized = normalizeRegionalPreference(value);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('dwp:regional-preference-change', { detail: normalized }));
  }
  return normalized;
}
