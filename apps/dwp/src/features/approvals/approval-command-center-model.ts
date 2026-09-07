import type { ApprovalTask, ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

export const APPROVAL_BATCH_LIMIT = 20;

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
  approvedTaskIds: readonly string[];
  ineligibleTaskIds: readonly string[];
  failedTaskId?: string;
  remainingTaskIds: readonly string[];
}>;

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

export type ApprovalWorkflowEvidenceStep = Readonly<{
  key: string;
  name: string;
  sequence: number;
  state: 'COMPLETED' | 'CURRENT';
}>;

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

export function buildApprovalWorkflowEvidence(
  detail: ApprovalTaskDetail
): ApprovalWorkflowEvidenceStep[] {
  const completed = new Map<number, ApprovalWorkflowEvidenceStep>();
  detail.timeline.forEach((event) => {
    if (!event.stepName || event.stepSequence == null) return;
    if (event.stepSequence >= detail.task.stepSequence) return;
    completed.set(event.stepSequence, {
      key: `completed-${event.stepSequence}-${event.stepName}`,
      name: event.stepName,
      sequence: event.stepSequence,
      state: 'COMPLETED',
    });
  });
  return [
    ...[...completed.values()].sort((left, right) => left.sequence - right.sequence),
    {
      key: `current-${detail.task.stepSequence}-${detail.task.stepKey}`,
      name: detail.task.stepName,
      sequence: detail.task.stepSequence,
      state: 'CURRENT' as const,
    },
  ];
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
  const approvedTaskIds: string[] = [];
  const ineligibleTaskIds: string[] = [];

  for (const [index, taskId] of taskIds.slice(0, APPROVAL_BATCH_LIMIT).entries()) {
    let detail: ApprovalTaskDetail;
    try {
      detail = await loadTask(taskId);
    } catch {
      return {
        approvedTaskIds,
        ineligibleTaskIds,
        failedTaskId: taskId,
        remainingTaskIds: taskIds.slice(index + 1, APPROVAL_BATCH_LIMIT),
      };
    }
    if (!detail.canDecide || detail.selfApprovalBlocked) {
      ineligibleTaskIds.push(taskId);
      continue;
    }
    try {
      await approveTask(detail);
      approvedTaskIds.push(taskId);
    } catch {
      return {
        approvedTaskIds,
        ineligibleTaskIds,
        failedTaskId: taskId,
        remainingTaskIds: taskIds.slice(index + 1, APPROVAL_BATCH_LIMIT),
      };
    }
  }

  return { approvedTaskIds, ineligibleTaskIds, remainingTaskIds: [] };
}
