import type { ApprovalIntegrationDelivery, ApprovalOperations } from '@dwp-frontend/shared-utils';
import { approvalDeliveryRetryEligibility } from './approval-management-model';

export type ApprovalOperationsQueue = 'delivery' | 'sla' | 'resolved';
export type ApprovalOperationsStatus = 'ALL' | 'PENDING' | 'SENDING' | 'FAILED' | 'DEAD';
export type ApprovalOperationsSort = 'OLDEST' | 'NEWEST' | 'AVAILABLE';

export function approvalOperationsQueueFromSearch(
  search: URLSearchParams
): ApprovalOperationsQueue {
  const values = search.getAll('queue');
  if (values.length !== 1) return 'delivery';
  return values[0] === 'sla' || values[0] === 'resolved' ? values[0] : 'delivery';
}

export function approvalOperationsDeliveryQueue(
  deliveries: readonly ApprovalIntegrationDelivery[],
  queue: ApprovalOperationsQueue,
  status: ApprovalOperationsStatus,
  sort: ApprovalOperationsSort
) {
  const instant = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };
  return deliveries
    .filter(
      (delivery) =>
        queue !== 'sla' &&
        (queue === 'resolved'
          ? delivery.status === 'PUBLISHED'
          : delivery.status !== 'PUBLISHED') &&
        (queue === 'resolved' || status === 'ALL' || delivery.status === status)
    )
    .sort((left, right) => {
      const leftTime = instant(sort === 'AVAILABLE' ? left.availableAt : left.createdAt);
      const rightTime = instant(sort === 'AVAILABLE' ? right.availableAt : right.createdAt);
      if (leftTime === Number.MAX_SAFE_INTEGER && rightTime !== Number.MAX_SAFE_INTEGER) return 1;
      if (rightTime === Number.MAX_SAFE_INTEGER && leftTime !== Number.MAX_SAFE_INTEGER) return -1;
      const difference = sort === 'NEWEST' ? rightTime - leftTime : leftTime - rightTime;
      return difference || left.outboxId.localeCompare(right.outboxId);
    });
}

export type ApprovalOperationsQueryState = Readonly<{
  status: string;
  fetchStatus: string;
  error: unknown;
  fetchFailureCount: number;
  data?: ApprovalOperations;
}>;

export function approvalOperationsSourceCurrent(
  state: ApprovalOperationsQueryState | undefined,
  now = Date.now()
) {
  if (
    !state ||
    state.status !== 'success' ||
    state.fetchStatus !== 'idle' ||
    state.error != null ||
    state.fetchFailureCount !== 0 ||
    !state.data
  )
    return false;
  const generatedAt = Date.parse(state.data.generatedAt);
  return Number.isFinite(generatedAt) && generatedAt <= now && now - generatedAt < 45_000;
}

export function approvalOperationsRetrySnapshotCurrent(
  state: ApprovalOperationsQueryState | undefined,
  original: Readonly<{
    outboxId: string;
    expectedVersion: number;
    deliveryFingerprint: string;
    scopeFingerprint: string;
  }> | null,
  current: Readonly<{ selectedId: string | null; scopeFingerprint: string; canOperate: boolean }>,
  now = Date.now()
) {
  if (
    !original ||
    !current.canOperate ||
    original.outboxId !== current.selectedId ||
    original.scopeFingerprint !== current.scopeFingerprint ||
    !approvalOperationsSourceCurrent(state, now)
  )
    return false;
  const delivery = state?.data?.integrationDeliveries.find(
    (item) => item.outboxId === original.outboxId
  );
  if (!delivery || JSON.stringify(delivery) !== original.deliveryFingerprint) return false;
  const eligibility = approvalDeliveryRetryEligibility(delivery);
  const evaluatedAt = Date.parse(eligibility.evaluatedAt ?? '');
  return (
    eligibility.eligible &&
    eligibility.expectedVersion === original.expectedVersion &&
    Number.isFinite(evaluatedAt) &&
    evaluatedAt <= now &&
    now - evaluatedAt < 45_000
  );
}
