import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

const TRANSIENT_MEETING_HOME_STATUSES = new Set([502, 503, 504]);
const AUTHORITY_RESOLUTION_UNAVAILABLE = 'AUTHORITY_RESOLUTION_UNAVAILABLE';

function isAuthorityResolutionUnavailable(error: HttpError): boolean {
  if (error.status !== 503) return false;
  const details = error.details;
  if (!details || typeof details !== 'object' || Array.isArray(details)) return false;
  const errorCode = (details as Record<string, unknown>).errorCode;
  return (
    typeof errorCode === 'string' &&
    errorCode.trim().toUpperCase() === AUTHORITY_RESOLUTION_UNAVAILABLE
  );
}

export function retryMeetingHomeQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof HttpTransportError) {
    return error.reason === 'NETWORK' || error.reason === 'TIMEOUT';
  }
  return (
    error instanceof HttpError &&
    TRANSIENT_MEETING_HOME_STATUSES.has(error.status) &&
    !isAuthorityResolutionUnavailable(error)
  );
}

export function meetingHomeQueryRetryDelay(failureCount: number): number {
  return failureCount === 0 ? 1_000 : 2_000;
}
