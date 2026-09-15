import { resolveApprovalContentAccess } from '@dwp-frontend/shared-utils';

import type { ApprovalTask, ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

export type ApprovalBatchPreflightOutcome = 'ELIGIBLE' | 'EXCLUDED' | 'RECHECK';

export type ApprovalBatchPreflightReason =
  | 'DETAIL_LOADING'
  | 'DETAIL_UNAVAILABLE'
  | 'QUEUE_CHANGED'
  | 'CONTENT_ACCESS_DENIED'
  | 'SELF_APPROVAL_BLOCKED'
  | 'DECISION_AUTHORITY_UNAVAILABLE';

export type ApprovalBatchPreflightInspection = Readonly<{
  taskId: string;
  detail?: ApprovalTaskDetail;
  state: 'LOADING' | 'READY' | 'ERROR';
  denied?: boolean;
}>;

export type ApprovalBatchPreflightEntry = Readonly<{
  taskId: string;
  requestNumber: string;
  title: string;
  outcome: ApprovalBatchPreflightOutcome;
  reason?: ApprovalBatchPreflightReason;
}>;

export type ApprovalBatchPreflight = Readonly<{
  entries: readonly ApprovalBatchPreflightEntry[];
  selectedCount: number;
  eligibleCount: number;
  excludedCount: number;
  recheckCount: number;
}>;

function fallbackIdentity(taskId: string) {
  return { requestNumber: taskId, title: taskId };
}

export function buildApprovalBatchPreflight({
  selectedTaskIds,
  queueTasks,
  inspections,
}: {
  selectedTaskIds: readonly string[];
  queueTasks: readonly ApprovalTask[];
  inspections: readonly ApprovalBatchPreflightInspection[];
}): ApprovalBatchPreflight {
  const tasksById = new Map(queueTasks.map((task) => [task.taskId, task]));
  const inspectionsById = new Map(inspections.map((inspection) => [inspection.taskId, inspection]));
  const entries = selectedTaskIds.map((taskId): ApprovalBatchPreflightEntry => {
    const queueTask = tasksById.get(taskId);
    const identity = queueTask ?? fallbackIdentity(taskId);
    const inspection = inspectionsById.get(taskId);

    if (!queueTask) {
      return { taskId, ...identity, outcome: 'RECHECK', reason: 'QUEUE_CHANGED' };
    }
    if (inspection?.denied) {
      return { taskId, ...identity, outcome: 'EXCLUDED', reason: 'CONTENT_ACCESS_DENIED' };
    }
    if (!inspection || inspection.state === 'LOADING') {
      return { taskId, ...identity, outcome: 'RECHECK', reason: 'DETAIL_LOADING' };
    }
    if (inspection.state === 'ERROR' || !inspection.detail) {
      return { taskId, ...identity, outcome: 'RECHECK', reason: 'DETAIL_UNAVAILABLE' };
    }

    const detail = inspection.detail;
    if (detail.task.taskId !== taskId || detail.task.version !== queueTask.version) {
      return { taskId, ...identity, outcome: 'RECHECK', reason: 'QUEUE_CHANGED' };
    }
    if (!resolveApprovalContentAccess(detail).full) {
      return { taskId, ...identity, outcome: 'EXCLUDED', reason: 'CONTENT_ACCESS_DENIED' };
    }
    if (detail.selfApprovalBlocked) {
      return { taskId, ...identity, outcome: 'EXCLUDED', reason: 'SELF_APPROVAL_BLOCKED' };
    }
    if (!detail.canDecide) {
      return {
        taskId,
        ...identity,
        outcome: 'EXCLUDED',
        reason: 'DECISION_AUTHORITY_UNAVAILABLE',
      };
    }
    return { taskId, ...identity, outcome: 'ELIGIBLE' };
  });

  return {
    entries,
    selectedCount: entries.length,
    eligibleCount: entries.filter(({ outcome }) => outcome === 'ELIGIBLE').length,
    excludedCount: entries.filter(({ outcome }) => outcome === 'EXCLUDED').length,
    recheckCount: entries.filter(({ outcome }) => outcome === 'RECHECK').length,
  };
}

export function approvalBatchEligibleTaskIds(preflight: ApprovalBatchPreflight) {
  return preflight.entries
    .filter(({ outcome }) => outcome === 'ELIGIBLE')
    .map(({ taskId }) => taskId);
}
