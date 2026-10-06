import { Temporal } from 'temporal-polyfill';

export const ASSIGNMENT_REGISTER_STATUSES = [
  'ALL',
  'ACTIVE',
  'LEAVE',
  'PENDING',
  'TERMINATED',
] as const;

export type AssignmentRegisterStatus = (typeof ASSIGNMENT_REGISTER_STATUSES)[number];

export type AssignmentRegisterFilters = Readonly<{
  asOf: string;
  query: string;
  status: AssignmentRegisterStatus;
  personId: string | null;
}>;

function isCalendarDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
}

function isAssignmentStatus(value: string | null): value is AssignmentRegisterStatus {
  return ASSIGNMENT_REGISTER_STATUSES.some((status) => status === value);
}

export function resolveAssignmentRegisterFilters(
  searchParams: URLSearchParams,
  currentDate: string
): AssignmentRegisterFilters {
  const requestedAsOf = searchParams.get('asOf');
  const requestedStatus = searchParams.get('status');
  return {
    asOf: isCalendarDate(requestedAsOf) ? requestedAsOf : currentDate,
    query: searchParams.get('q') ?? '',
    status: isAssignmentStatus(requestedStatus) ? requestedStatus : 'ALL',
    personId: searchParams.get('person')?.trim() || null,
  };
}

export function replaceAssignmentRegisterSearchParams(
  current: URLSearchParams,
  values: Readonly<Record<string, string | null | undefined>>
): URLSearchParams {
  const next = new URLSearchParams(current);
  Object.entries(values).forEach(([key, value]) => {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      (key === 'status' && value === 'ALL')
    )
      next.delete(key);
    else next.set(key, value);
  });
  return next;
}
