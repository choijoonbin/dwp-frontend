import { HttpError } from '@dwp-frontend/shared-utils';

type ManagementSource = {
  data: unknown;
  error: unknown;
  failureReason: unknown;
  failureCount: number;
  isError: boolean;
  isPending: boolean;
};

export function approvalManagementReadDenied(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  if ([401, 403, 404].includes(error.status)) return true;
  const details = error.details;
  const code =
    details && typeof details === 'object' && 'errorCode' in details
      ? details.errorCode
      : undefined;
  return (
    (error.status === 409 && code === 'SCOPE_CONTEXT_EXPIRED') ||
    (error.status === 503 && code === 'AUTHORITY_RESOLUTION_UNAVAILABLE')
  );
}

export function retryApprovalManagementRead(failureCount: number, error: unknown): boolean {
  return !approvalManagementReadDenied(error) && failureCount < 1;
}

export function approvalManagementSourceState(source: ManagementSource) {
  if (approvalManagementReadDenied(source.failureReason ?? source.error)) return 'DENIED';
  if (source.isError || source.failureCount > 0 || source.failureReason != null) {
    return source.data === undefined ? 'UNAVAILABLE' : 'STALE';
  }
  if (source.data !== undefined) return 'READY';
  return source.isPending ? 'LOADING' : 'UNAVAILABLE';
}
