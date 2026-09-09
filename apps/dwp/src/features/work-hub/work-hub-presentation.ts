import type { WorkHubItem, WorkHubLifecycle } from './work-hub-contracts';

const SOURCE_STATUS_LABELS: Record<string, Record<string, string>> = {
  APPROVAL_TASK: {
    PENDING: 'approvalPending',
    CLAIMED: 'approvalClaimed',
    INFO_REQUESTED: 'approvalInfo',
  },
  APPROVAL_REQUEST: { NEEDS_INFO: 'requestNeedsInfo' },
  SERVICE_REQUEST: {
    DRAFT: 'serviceDraft',
    SUBMITTED: 'serviceSubmitted',
    TRIAGED: 'serviceTriaged',
    IN_PROGRESS: 'serviceInProgress',
    AWAITING_REQUESTER: 'serviceAwaiting',
    RESOLVED: 'serviceResolved',
    CLOSED: 'serviceClosed',
  },
  IDENTITY_GOVERNANCE: {
    OPEN: 'reviewPending',
    open: 'reviewPending',
    PENDING: 'reviewPending',
    'due-soon': 'reviewPending',
    'in-progress': 'reviewInProgress',
  },
};

export function workHubSourceStatusLabelKey(
  sourceSystem: string,
  sourceStatus: string,
  lifecycle?: WorkHubLifecycle
): string {
  const label = SOURCE_STATUS_LABELS[sourceSystem]?.[sourceStatus];
  if (label) return `workHub.statusLabels.${label}`;
  return lifecycle ? `workHub.lifecycle.${lifecycle}` : 'workHub.sourceStatuses.UNKNOWN';
}

/** Lifecycle drives cross-source views; the visible label preserves the owner's business state. */
export function workHubStatusLabelKey(item: WorkHubItem): string {
  return workHubSourceStatusLabelKey(
    item.reference.sourceSystem,
    item.sourceStatus,
    item.lifecycle
  );
}

/** Only source-issued business identifiers are suitable for general user-facing labels. */
export function workHubDisplayId(item: WorkHubItem): string | null {
  const displayId = item.displayId?.trim();
  return displayId ? displayId : null;
}
