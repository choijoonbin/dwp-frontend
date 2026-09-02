import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

export type CalendarReadSourceState = 'LOADING' | 'READY' | 'STALE' | 'DENIED' | 'UNAVAILABLE';

type CalendarReadSourceSnapshot<T> = Readonly<{
  data: T | undefined;
  error: unknown;
  failureCount?: number;
  failureReason?: unknown;
  isError: boolean;
  isPending: boolean;
}>;

function reasonCode(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const record = details as Record<string, unknown>;
  const value = record.errorCode ?? record.reasonCode ?? record.code;
  return typeof value === 'string' ? value.trim().toUpperCase() : null;
}

export function isAuthoritativeCalendarReadFailure(error: unknown) {
  if (!(error instanceof HttpError)) return false;
  if ([401, 403, 404].includes(error.status)) return true;
  const reason = reasonCode(error.details);
  return (
    (error.status === 409 &&
      (reason === 'DECISION_REVISION_CONFLICT' || reason === 'SCOPE_CONTEXT_EXPIRED')) ||
    (error.status === 503 && reason === 'AUTHORITY_RESOLUTION_UNAVAILABLE')
  );
}

export function isRecoverableCalendarReadFailure(error: unknown) {
  if (error instanceof HttpTransportError) return true;
  if (!(error instanceof HttpError) || isAuthoritativeCalendarReadFailure(error)) return false;
  return [408, 425, 429].includes(error.status) || error.status >= 500;
}

export function retryRecoverableCalendarRead(failureCount: number, error: unknown) {
  return isRecoverableCalendarReadFailure(error) && failureCount < 1;
}

export function calendarReadSourceState<T>(
  snapshot: CalendarReadSourceSnapshot<T>
): CalendarReadSourceState {
  const failed = snapshot.isError || (snapshot.failureCount ?? 0) > 0;
  if (failed) {
    const failure = snapshot.failureReason ?? snapshot.error;
    if (isAuthoritativeCalendarReadFailure(failure)) return 'DENIED';
    if (isRecoverableCalendarReadFailure(failure)) {
      return snapshot.data === undefined ? 'UNAVAILABLE' : 'STALE';
    }
    return 'UNAVAILABLE';
  }
  if (snapshot.data !== undefined) return 'READY';
  return snapshot.isPending ? 'LOADING' : 'UNAVAILABLE';
}

export function calendarReadSourceData<T>(state: CalendarReadSourceState, data: T | undefined) {
  return state === 'READY' || state === 'STALE' ? data : undefined;
}

export function combineCalendarReadSourceStates(
  states: readonly CalendarReadSourceState[]
): CalendarReadSourceState {
  if (states.some((state) => state === 'DENIED')) return 'DENIED';
  if (states.some((state) => state === 'UNAVAILABLE')) return 'UNAVAILABLE';
  if (states.some((state) => state === 'STALE')) return 'STALE';
  if (states.some((state) => state === 'LOADING')) return 'LOADING';
  return 'READY';
}
