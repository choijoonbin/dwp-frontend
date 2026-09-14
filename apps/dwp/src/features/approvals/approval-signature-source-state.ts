import { HttpError } from '@dwp-frontend/shared-utils';
import { approvalManagementReadDenied } from './approval-management-source-state';

export { retryApprovalManagementRead as retryApprovalSignatureRead } from './approval-management-source-state';
type SignatureSource = {
  data: unknown;
  error?: unknown;
  failureReason?: unknown;
  failureCount?: number;
  isError?: boolean;
  isPending?: boolean;
  isFetching?: boolean;
};
export function approvalSignatureSourceState(source: SignatureSource) {
  const failure = source.failureReason ?? source.error;
  // A 503 cannot provide current verification. Cached configuration is still
  // displayable, but none of its former readiness decisions remain current.
  if (
    !(failure instanceof HttpError && failure.status === 503) &&
    approvalManagementReadDenied(failure)
  )
    return 'DENIED';
  if (source.data === undefined && source.isPending && failure == null) return 'LOADING';
  if (source.isError || failure != null || (source.failureCount ?? 0) > 0 || source.isFetching) {
    return source.data === undefined ? 'UNAVAILABLE' : 'STALE';
  }
  return source.data !== undefined ? 'READY' : 'UNAVAILABLE';
}
