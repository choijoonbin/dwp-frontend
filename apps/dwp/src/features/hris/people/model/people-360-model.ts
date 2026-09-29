import { Temporal } from 'temporal-polyfill';

import type { People360RequestScope } from './people-360-view-model';

export const PEOPLE_360_PAGE_SIZE = 50;

export type People360Filters = Readonly<{
  asOf: string;
  query: string;
  status: string;
  personId: string | null;
}>;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;

export function isCalendarDate(value: string | null | undefined): value is string {
  if (!value || !DATE_ONLY.test(value)) return false;
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
}

export function people360Today(
  timeZone: string,
  now: string = Temporal.Now.instant().toString()
): string {
  try {
    return Temporal.Instant.from(now).toZonedDateTimeISO(timeZone).toPlainDate().toString();
  } catch {
    return Temporal.Now.plainDateISO().toString();
  }
}

export function resolvePeople360Filters(
  searchParams: URLSearchParams,
  currentDate: string
): People360Filters {
  const requestedAsOf = searchParams.get('asOf');
  return {
    asOf: isCalendarDate(requestedAsOf) ? requestedAsOf : currentDate,
    query: searchParams.get('q')?.trim() ?? '',
    status: searchParams.get('status') || 'ALL',
    personId: searchParams.get('person')?.trim() || null,
  };
}

export function people360ListQueryKey(
  filters: Pick<People360Filters, 'asOf' | 'query' | 'status'>,
  requestScope: People360RequestScope
) {
  return [
    'hris',
    'people-360',
    'list-v2',
    filters.asOf,
    filters.query,
    filters.status,
    ...requestScope.cacheKey,
  ] as const;
}

export function people360DetailQueryKey(
  personId: string | null,
  asOf: string,
  requestScope: People360RequestScope
) {
  return [
    'hris',
    'people-360',
    'detail-v2',
    personId ?? '',
    asOf,
    ...requestScope.cacheKey,
  ] as const;
}

export function replacePeople360SearchParams(
  current: URLSearchParams,
  values: Readonly<Record<string, string | null | undefined>>
): URLSearchParams {
  const next = new URLSearchParams(current);
  Object.entries(values).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '' || value === 'ALL') next.delete(key);
    else next.set(key, value);
  });
  return next;
}
