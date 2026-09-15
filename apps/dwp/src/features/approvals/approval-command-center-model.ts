import { resolveApprovalContentAccess } from '@dwp-frontend/shared-utils/api/approval-content-access';

import type { ApprovalTask, ApprovalTaskDetail } from '@dwp-frontend/shared-utils/api/approval-api';
import type { ApprovalQuorumTaskSnapshot } from '@dwp-frontend/shared-utils/api/approval-quorum-contract';

export type ApprovalDecisionConfirmation = Readonly<{
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  taskId: string;
  expectedVersion: number;
  scopeIdentity: string;
  quorum?: ApprovalQuorumTaskSnapshot | null;
}>;

export const APPROVAL_BATCH_LIMIT = 20;

export function approvalScopeIdentity(cacheKey: readonly string[]): string {
  return JSON.stringify(cacheKey);
}

export const approvalTaskContentAccess = resolveApprovalContentAccess;

export function hasApprovalTaskContentAccess(detail: ApprovalTaskDetail): boolean {
  return approvalTaskContentAccess(detail).full;
}

export type ApprovalQueueFilter = 'ALL' | 'URGENT' | 'DUE_TODAY' | 'HIGH_RISK';

export const APPROVAL_QUEUE_FILTERS: readonly ApprovalQueueFilter[] = [
  'ALL',
  'URGENT',
  'DUE_TODAY',
  'HIGH_RISK',
];

export function parseApprovalQueueFilter(value: string | null | undefined): ApprovalQueueFilter {
  return APPROVAL_QUEUE_FILTERS.includes(value as ApprovalQueueFilter)
    ? (value as ApprovalQueueFilter)
    : 'ALL';
}

export type ApprovalBatchResult = Readonly<{
  requestedTaskIds: readonly string[];
  approvedTaskIds: readonly string[];
  ineligibleTaskIds: readonly string[];
  failedTaskId?: string;
  failure?: ApprovalBatchFailure;
  remainingTaskIds: readonly string[];
}>;

export type ApprovalBatchOutcome = 'APPROVED' | 'INELIGIBLE' | 'FAILED' | 'NOT_ATTEMPTED';

export type ApprovalBatchFailureReason =
  'AUTHORITY_DENIED' | 'VERSION_CONFLICT' | 'SERVICE_UNAVAILABLE' | 'UNKNOWN';

export type ApprovalBatchFailure = Readonly<{
  taskId: string;
  phase: 'REVALIDATE' | 'DECISION';
  reason: ApprovalBatchFailureReason;
  retryable: boolean;
}>;

function approvalBatchFailure(
  taskId: string,
  phase: ApprovalBatchFailure['phase'],
  error: unknown
): ApprovalBatchFailure {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined;
  if (status === 403) return { taskId, phase, reason: 'AUTHORITY_DENIED', retryable: false };
  if (status === 409) return { taskId, phase, reason: 'VERSION_CONFLICT', retryable: true };
  if (status === 503) return { taskId, phase, reason: 'SERVICE_UNAVAILABLE', retryable: true };
  return { taskId, phase, reason: 'UNKNOWN', retryable: false };
}

export function approvalBatchOutcome(
  result: ApprovalBatchResult,
  taskId: string
): ApprovalBatchOutcome {
  if (result.approvedTaskIds.includes(taskId)) return 'APPROVED';
  if (result.ineligibleTaskIds.includes(taskId)) return 'INELIGIBLE';
  if (result.failedTaskId === taskId) return 'FAILED';
  return 'NOT_ATTEMPTED';
}

export function approvalBatchRetryTaskIds(result: ApprovalBatchResult): string[] {
  if (!result.failedTaskId || !result.failure?.retryable) return [];
  return [result.failedTaskId, ...result.remainingTaskIds];
}

export function mergeApprovalBatchRetryResult(
  previous: ApprovalBatchResult,
  retry: ApprovalBatchResult
): ApprovalBatchResult {
  const allowed = new Set(approvalBatchRetryTaskIds(previous));
  if (
    retry.requestedTaskIds.length === 0 ||
    retry.requestedTaskIds.length !== allowed.size ||
    retry.requestedTaskIds.some((taskId) => !allowed.has(taskId))
  ) {
    throw new Error('Invalid approval batch retry result');
  }

  const approvedTaskIds = new Set(previous.approvedTaskIds);
  const ineligibleTaskIds = new Set(previous.ineligibleTaskIds);
  for (const taskId of allowed) {
    approvedTaskIds.delete(taskId);
    ineligibleTaskIds.delete(taskId);
  }
  for (const taskId of retry.approvedTaskIds) approvedTaskIds.add(taskId);
  for (const taskId of retry.ineligibleTaskIds) ineligibleTaskIds.add(taskId);

  return {
    requestedTaskIds: previous.requestedTaskIds,
    approvedTaskIds: previous.requestedTaskIds.filter((taskId) => approvedTaskIds.has(taskId)),
    ineligibleTaskIds: previous.requestedTaskIds.filter((taskId) => ineligibleTaskIds.has(taskId)),
    failedTaskId: retry.failedTaskId,
    failure: retry.failure,
    remainingTaskIds: retry.remainingTaskIds,
  };
}

export type ApprovalDecisionSignalKey =
  | 'SELF_APPROVAL_BLOCKED'
  | 'DECISION_AUTHORITY_UNAVAILABLE'
  | 'OVERDUE'
  | 'DUE_TODAY'
  | 'HIGH_RISK'
  | 'RESTRICTED_DATA'
  | 'STANDARD_REVIEW';

export type ApprovalDecisionSignal = Readonly<{
  key: ApprovalDecisionSignalKey;
  tone: 'critical' | 'warning' | 'info' | 'success';
}>;

export {
  buildApprovalWorkflowEvidence,
  type ApprovalWorkflowEvidenceStep,
} from '../../components/approval-workflow-evidence';

const PRIORITY_ORDER: Record<ApprovalTask['priority'], number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function timestamp(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isApprovalTaskOverdue(task: ApprovalTask, nowMs: number): boolean {
  const dueAtMs = timestamp(task.dueAt);
  return dueAtMs !== null && dueAtMs < nowMs;
}

export function isApprovalTaskDueToday(task: ApprovalTask, nowMs: number): boolean {
  const dueAtMs = timestamp(task.dueAt);
  if (dueAtMs === null) return false;
  const now = new Date(nowMs);
  const due = new Date(dueAtMs);
  return (
    now.getFullYear() === due.getFullYear() &&
    now.getMonth() === due.getMonth() &&
    now.getDate() === due.getDate()
  );
}

export function sortApprovalTasks(tasks: readonly ApprovalTask[]): ApprovalTask[] {
  return [...tasks].sort((left, right) => {
    const priority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priority !== 0) return priority;
    const risk = right.riskScore - left.riskScore;
    if (risk !== 0) return risk;
    const leftDue = timestamp(left.dueAt) ?? Number.MAX_SAFE_INTEGER;
    const rightDue = timestamp(right.dueAt) ?? Number.MAX_SAFE_INTEGER;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return left.taskId.localeCompare(right.taskId);
  });
}

export function filterApprovalTasks({
  tasks,
  filter,
  search,
  nowMs,
}: {
  tasks: readonly ApprovalTask[];
  filter: ApprovalQueueFilter;
  search: string;
  nowMs: number;
}): ApprovalTask[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  return sortApprovalTasks(tasks).filter((task) => {
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'URGENT' && task.priority === 'URGENT') ||
      (filter === 'DUE_TODAY' && isApprovalTaskDueToday(task, nowMs)) ||
      (filter === 'HIGH_RISK' && task.riskScore >= 70);
    if (!matchesFilter) return false;
    if (!normalizedSearch) return true;
    return [
      task.requestNumber,
      task.title,
      task.summary,
      task.requesterName,
      task.requesterOrgName,
      task.stepName,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  });
}

export function approvalQueueCounts(
  tasks: readonly ApprovalTask[],
  nowMs: number
): Record<ApprovalQueueFilter, number> {
  return {
    ALL: tasks.length,
    URGENT: tasks.filter((task) => task.priority === 'URGENT').length,
    DUE_TODAY: tasks.filter((task) => isApprovalTaskDueToday(task, nowMs)).length,
    HIGH_RISK: tasks.filter((task) => task.riskScore >= 70).length,
  };
}

export function buildApprovalDecisionSignals(
  detail: ApprovalTaskDetail,
  nowMs: number
): ApprovalDecisionSignal[] {
  const signals: ApprovalDecisionSignal[] = [];
  if (detail.selfApprovalBlocked) {
    signals.push({ key: 'SELF_APPROVAL_BLOCKED', tone: 'critical' });
  } else if (!detail.canDecide) {
    signals.push({ key: 'DECISION_AUTHORITY_UNAVAILABLE', tone: 'warning' });
  }
  if (isApprovalTaskOverdue(detail.task, nowMs)) {
    signals.push({ key: 'OVERDUE', tone: 'critical' });
  } else if (isApprovalTaskDueToday(detail.task, nowMs)) {
    signals.push({ key: 'DUE_TODAY', tone: 'warning' });
  }
  if (detail.task.riskScore >= 70) {
    signals.push({ key: 'HIGH_RISK', tone: detail.task.riskScore >= 85 ? 'critical' : 'warning' });
  }
  if (['CONFIDENTIAL', 'RESTRICTED'].includes(detail.task.dataClassification)) {
    signals.push({ key: 'RESTRICTED_DATA', tone: 'info' });
  }
  if (signals.length === 0) signals.push({ key: 'STANDARD_REVIEW', tone: 'success' });
  return signals;
}

export function toggleApprovalBatchSelection(
  selectedTaskIds: readonly string[],
  taskId: string,
  limit = APPROVAL_BATCH_LIMIT
): string[] {
  if (selectedTaskIds.includes(taskId)) {
    return selectedTaskIds.filter((candidate) => candidate !== taskId);
  }
  if (selectedTaskIds.length >= limit) return [...selectedTaskIds];
  return [...selectedTaskIds, taskId];
}

export async function executeSequentialApprovalBatch({
  taskIds,
  loadTask,
  approveTask,
}: {
  taskIds: readonly string[];
  loadTask: (taskId: string) => Promise<ApprovalTaskDetail>;
  approveTask: (detail: ApprovalTaskDetail) => Promise<void>;
}): Promise<ApprovalBatchResult> {
  const requestedTaskIds = taskIds.slice(0, APPROVAL_BATCH_LIMIT);
  const approvedTaskIds: string[] = [];
  const ineligibleTaskIds: string[] = [];

  for (const [index, taskId] of requestedTaskIds.entries()) {
    let detail: ApprovalTaskDetail;
    try {
      detail = await loadTask(taskId);
    } catch (error) {
      return {
        requestedTaskIds,
        approvedTaskIds,
        ineligibleTaskIds,
        failedTaskId: taskId,
        failure: approvalBatchFailure(taskId, 'REVALIDATE', error),
        remainingTaskIds: requestedTaskIds.slice(index + 1),
      };
    }
    if (!hasApprovalTaskContentAccess(detail) || !detail.canDecide || detail.selfApprovalBlocked) {
      ineligibleTaskIds.push(taskId);
      continue;
    }
    try {
      await approveTask(detail);
      approvedTaskIds.push(taskId);
    } catch (error) {
      return {
        requestedTaskIds,
        approvedTaskIds,
        ineligibleTaskIds,
        failedTaskId: taskId,
        failure: approvalBatchFailure(taskId, 'DECISION', error),
        remainingTaskIds: requestedTaskIds.slice(index + 1),
      };
    }
  }

  return { requestedTaskIds, approvedTaskIds, ineligibleTaskIds, remainingTaskIds: [] };
}
