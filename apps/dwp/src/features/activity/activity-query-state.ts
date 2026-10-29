import { HttpError } from '@dwp-frontend/shared-utils';

type ActivityQuerySnapshot<T> = {
  data?: T;
  isError: boolean;
  error?: unknown;
};

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
