import type {
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestSummary,
} from '@dwp-frontend/shared-utils';

const STATUS_RANK: Record<ServiceRequestStatus, number> = {
  AWAITING_REQUESTER: 0,
  DRAFT: 1,
  SUBMITTED: 2,
  TRIAGED: 3,
  IN_PROGRESS: 4,
  RESOLVED: 5,
  CLOSED: 6,
  CANCELLED: 7,
};

const PRIORITY_RANK: Record<ServiceRequestPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function timestamp(value?: string | null, fallback = Number.MAX_SAFE_INTEGER) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function prioritizeHrServiceRequests(
  requests: readonly ServiceRequestSummary[]
): ServiceRequestSummary[] {
  return [...requests].sort((left, right) => {
    const status = STATUS_RANK[left.status] - STATUS_RANK[right.status];
    if (status !== 0) return status;

    const priority = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (priority !== 0) return priority;

    const sla = timestamp(left.slaDueAt) - timestamp(right.slaDueAt);
    if (sla !== 0) return sla;

    return timestamp(right.updatedAt, 0) - timestamp(left.updatedAt, 0);
  });
}
