import { HttpError } from '@dwp-frontend/shared-utils';

import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';

type ActivityQuerySnapshot<T> = {
  data?: T;
  isError: boolean;
  error?: unknown;
};

export const ACTIVITY_RUNNING_REFRESH_INTERVAL_MS = 15_000;

export function isAuthoritativeActivityDenial(error: unknown): boolean {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

/** Root Activity authorization is shared by feed, summary and connector-status endpoints. */
export function isAuthoritativeActivityRootDenial(error: unknown): boolean {
  return error instanceof HttpError && [401, 403].includes(error.status);
}

/** Preserve prior success only for transient refresh failures, never for access denial/deletion. */
export function usableActivityQueryData<T>(query: ActivityQuerySnapshot<T>): T | undefined {
  return query.isError && isAuthoritativeActivityDenial(query.error) ? undefined : query.data;
}

export function activityDetailRefreshInterval(
  event: Pick<WorkspaceActivityEvent, 'state'> | undefined
): number | false {
  return event?.state === 'running' ? ACTIVITY_RUNNING_REFRESH_INTERVAL_MS : false;
}

export function activityDetailStaleTime(
  event: Pick<WorkspaceActivityEvent, 'state'> | undefined
): number {
  return event && activityDetailRefreshInterval(event) === false ? Infinity : 15_000;
}

export function activityDetailRefetchOnWindowFocus(
  event: Pick<WorkspaceActivityEvent, 'state'> | undefined
): boolean {
  return activityDetailRefreshInterval(event) !== false;
}
