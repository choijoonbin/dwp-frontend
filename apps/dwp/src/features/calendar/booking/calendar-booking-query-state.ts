import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

export type CalendarBookingQueryState =
  'LOADING' | 'READY' | 'EMPTY' | 'STALE' | 'PARTIAL' | 'DENIED' | 'DISABLED' | 'UNAVAILABLE';

export type CalendarBookingQuerySnapshot<T> = Readonly<{
  data: T | undefined;
  error: unknown;
  isError: boolean;
  isPending: boolean;
  isFetching?: boolean;
}>;

function reasonCode(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const record = details as Record<string, unknown>;
  const value = record.errorCode ?? record.reasonCode ?? record.code;
  return typeof value === 'string' ? value.trim().toUpperCase() : null;
}

export function isCalendarBookingAuthorityFailure(error: unknown) {
  if (!(error instanceof HttpError)) return false;
  if ([401, 403, 404].includes(error.status)) return true;
  const reason = reasonCode(error.details);
  return (
    (error.status === 409 &&
      (reason === 'DECISION_REVISION_CONFLICT' || reason === 'SCOPE_CONTEXT_EXPIRED')) ||
    (error.status === 503 && reason === 'AUTHORITY_RESOLUTION_UNAVAILABLE')
  );
}

export function isCalendarBookingVersionConflict(error: unknown) {
  if (!(error instanceof HttpError) || error.status !== 409) return false;
  const reason = reasonCode(error.details);
  return !reason || reason.includes('VERSION') || reason.includes('CONFLICT');
}

export function isRecoverableCalendarBookingFailure(error: unknown) {
  if (error instanceof HttpTransportError) return true;
  return (
    error instanceof HttpError &&
    !isCalendarBookingAuthorityFailure(error) &&
    ([408, 425, 429].includes(error.status) || error.status >= 500)
  );
}

export function retryCalendarBookingRead(failureCount: number, error: unknown) {
  return failureCount < 1 && isRecoverableCalendarBookingFailure(error);
}

export function calendarBookingQueryState<T>(
  snapshot: CalendarBookingQuerySnapshot<T>,
  options: Readonly<{
    enabled: boolean;
    empty: (data: T) => boolean;
    partial?: (data: T) => boolean;
  }>
): CalendarBookingQueryState {
  if (!options.enabled) return 'DISABLED';
  if (snapshot.isError) {
    if (isCalendarBookingAuthorityFailure(snapshot.error)) return 'DENIED';
    if (snapshot.data !== undefined && isRecoverableCalendarBookingFailure(snapshot.error)) {
      return 'STALE';
    }
    return 'UNAVAILABLE';
  }
  if (snapshot.data !== undefined) {
    if (options.partial?.(snapshot.data)) return 'PARTIAL';
    return options.empty(snapshot.data) ? 'EMPTY' : 'READY';
  }
  return snapshot.isPending || snapshot.isFetching ? 'LOADING' : 'UNAVAILABLE';
}

export function calendarBookingMutationAllowed(
  states: readonly CalendarBookingQueryState[],
  versionsMatch = true
) {
  return versionsMatch && states.every((state) => state === 'READY' || state === 'EMPTY');
}

export function combineCalendarBookingQueryStates(
  states: readonly CalendarBookingQueryState[]
): CalendarBookingQueryState {
  if (states.some((state) => state === 'DENIED')) return 'DENIED';
  if (states.some((state) => state === 'DISABLED')) return 'DISABLED';
  if (states.some((state) => state === 'UNAVAILABLE')) return 'UNAVAILABLE';
  if (states.some((state) => state === 'STALE')) return 'STALE';
  if (states.some((state) => state === 'PARTIAL')) return 'PARTIAL';
  if (states.some((state) => state === 'LOADING')) return 'LOADING';
  if (states.length > 0 && states.every((state) => state === 'EMPTY')) return 'EMPTY';
  return 'READY';
}

export function calendarBookingShouldPurge(state: CalendarBookingQueryState) {
  return state === 'DENIED' || state === 'DISABLED';
}

export function calendarBookingVisibleData<T>(
  state: CalendarBookingQueryState,
  data: T | undefined
) {
  return state === 'READY' || state === 'EMPTY' || state === 'PARTIAL' || state === 'STALE'
    ? data
    : undefined;
}
