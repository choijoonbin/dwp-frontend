import { describe, expect, it, vi } from 'vitest';

import {
  APPROVAL_QUEUE_FILTERS,
  approvalBatchOutcome,
  approvalBatchRetryTaskIds,
  approvalQueueCounts,
  approvalScopeIdentity,
  approvalTaskContentAccess,
  buildApprovalDecisionSignals,
  buildApprovalWorkflowEvidence,
  executeSequentialApprovalBatch,
  filterApprovalTasks,
  mergeApprovalBatchRetryResult,
  parseApprovalQueueFilter,
  toggleApprovalBatchSelection,
} from './approval-command-center-model';

import type { ApprovalTask, ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

const NOW = Date.parse('2026-09-03T10:00:00Z');

function task(overrides: Partial<ApprovalTask> = {}): ApprovalTask {
  return {
    taskId: 'task-normal',
    requestId: 'request-normal',
    requestNumber: 'APR-001',
    title: 'Normal request',
    summary: 'Review the request',
    workflowNameKo: '일반 결재',
    workflowNameEn: 'General approval',
    stepKey: 'MANAGER_REVIEW',
    stepName: 'Manager review',
    stepSequence: 1,
    requesterName: 'Kim',
    requesterOrgName: 'Platform',
    status: 'PENDING',
    priority: 'NORMAL',
    dataClassification: 'INTERNAL',
    riskScore: 30,
    dueAt: '2026-09-04T02:00:00Z',
    version: 1,
    ...overrides,
  };
}

function detail(taskId: string, canDecide = true): ApprovalTaskDetail {
  return {
    task: task({ taskId, requestId: `request-${taskId}` }),
    contentAccess: {
      state: 'FULL',
      reason: 'CURRENT_AUTHORITY_VERIFIED',
      evaluatedAt: '2026-09-03T09:59:00Z',
    },
    payload: {},
    timeline: [],
    canClaim: false,
    canDecide,
    selfApprovalBlocked: false,
  };
}

describe('approval command center model', () => {
  it('keeps delimiter-like authority components in distinct scope identities', () => {
    expect(approvalScopeIdentity(['tenant|a', 'scope'])).not.toBe(
      approvalScopeIdentity(['tenant', 'a|scope'])
    );
  });

  it('fails closed when content access evidence is missing, stale, or internally inconsistent', () => {
    const current = detail('task-content');
    expect(approvalTaskContentAccess(current).full).toBe(true);
    expect(
      approvalTaskContentAccess({
        ...current,
        contentAccess: {
          state: 'FULL',
          reason: 'CURRENT_PERMISSION_REVOKED',
          evaluatedAt: '2026-09-03T09:59:00Z',
        },
      })
    ).toEqual({
      full: false,
      reason: 'UNKNOWN',
      evaluatedAt: '2026-09-03T09:59:00Z',
    });
    expect(
      approvalTaskContentAccess({
        ...current,
        contentAccess: undefined,
      } as unknown as ApprovalTaskDetail)
    ).toEqual({ full: false, reason: 'UNKNOWN', evaluatedAt: null });
  });

  it('accepts only canonical queue filter values', () => {
    expect(APPROVAL_QUEUE_FILTERS).toEqual(['ALL', 'URGENT', 'DUE_TODAY', 'HIGH_RISK']);
    expect(parseApprovalQueueFilter('URGENT')).toBe('URGENT');
    expect(parseApprovalQueueFilter('urgent')).toBe('ALL');
    expect(parseApprovalQueueFilter('../HIGH_RISK')).toBe('ALL');
    expect(parseApprovalQueueFilter(null)).toBe('ALL');
  });

  it('sorts urgent work first and applies truthful queue filters and search', () => {
    const tasks = [
      task(),
      task({
        taskId: 'task-risk',
        requestNumber: 'APR-002',
        title: 'GPU purchase',
        priority: 'HIGH',
        riskScore: 82,
        dueAt: '2026-09-03T11:00:00Z',
      }),
      task({
        taskId: 'task-urgent',
        requestNumber: 'APR-003',
        title: 'Security exception',
        priority: 'URGENT',
        dueAt: '2026-09-02T11:00:00Z',
      }),
    ];

    expect(filterApprovalTasks({ tasks, filter: 'ALL', search: '', nowMs: NOW })).toEqual([
      tasks[2],
      tasks[1],
      tasks[0],
    ]);
    expect(filterApprovalTasks({ tasks, filter: 'DUE_TODAY', search: '', nowMs: NOW })).toEqual([
      tasks[1],
    ]);
    expect(filterApprovalTasks({ tasks, filter: 'HIGH_RISK', search: 'gpu', nowMs: NOW })).toEqual([
      tasks[1],
    ]);
    expect(approvalQueueCounts(tasks, NOW)).toEqual({
      ALL: 3,
      URGENT: 1,
      DUE_TODAY: 1,
      HIGH_RISK: 1,
    });
  });

  it('caps batch selection without losing existing selections', () => {
    expect(toggleApprovalBatchSelection(['task-1'], 'task-1')).toEqual([]);
    expect(toggleApprovalBatchSelection(['task-1'], 'task-2', 2)).toEqual(['task-1', 'task-2']);
    expect(toggleApprovalBatchSelection(['task-1', 'task-2'], 'task-3', 2)).toEqual([
      'task-1',
      'task-2',
    ]);
  });

  it('builds a truthful decision brief only from current task evidence', () => {
    const approval = detail('task-risk');
    approval.task = task({
      taskId: 'task-risk',
      riskScore: 91,
      dataClassification: 'RESTRICTED',
      dueAt: '2026-09-03T08:00:00Z',
    });

    expect(buildApprovalDecisionSignals(approval, NOW)).toEqual([
      { key: 'OVERDUE', tone: 'critical' },
      { key: 'HIGH_RISK', tone: 'critical' },
      { key: 'RESTRICTED_DATA', tone: 'info' },
    ]);
  });

  it('projects only recorded completed stages plus the real current stage', () => {
    const approval = detail('task-stage');
    approval.task = task({
      taskId: 'task-stage',
      stepKey: 'SECURITY_REVIEW',
      stepName: 'Security review',
      stepSequence: 2,
    });
    approval.timeline = [
      {
        eventId: 'event-1',
        eventType: 'TASK_APPROVED',
        actorType: 'USER',
        stepName: 'Manager review',
        stepSequence: 1,
        outcome: 'SUCCESS',
        occurredAt: '2026-09-03T08:00:00Z',
      },
      {
        eventId: 'event-request',
        eventType: 'REQUEST_SUBMITTED',
        actorType: 'USER',
        outcome: 'SUBMITTED',
        occurredAt: '2026-09-03T07:00:00Z',
      },
    ];

    expect(buildApprovalWorkflowEvidence(approval)).toEqual([
      {
        key: 'completed-1-Manager review',
        name: 'Manager review',
        sequence: 1,
        state: 'COMPLETED',
      },
      {
        key: 'current-2-SECURITY_REVIEW',
        name: 'Security review',
        sequence: 2,
        state: 'CURRENT',
      },
    ]);
  });

  it('revalidates every item serially, skips ineligible work, and stops after a write failure', async () => {
    const loadTask = vi.fn(async (taskId: string) => detail(taskId, taskId !== 'task-2'));
    const approveTask = vi.fn(async (approval: ApprovalTaskDetail) => {
      if (approval.task.taskId === 'task-3') throw new Error('authority changed');
    });

    const result = await executeSequentialApprovalBatch({
      taskIds: ['task-1', 'task-2', 'task-3', 'task-4'],
      loadTask,
      approveTask,
    });

    expect(result).toEqual({
      requestedTaskIds: ['task-1', 'task-2', 'task-3', 'task-4'],
      approvedTaskIds: ['task-1'],
      ineligibleTaskIds: ['task-2'],
      failedTaskId: 'task-3',
      failure: {
        taskId: 'task-3',
        phase: 'DECISION',
        reason: 'UNKNOWN',
        retryable: false,
      },
      remainingTaskIds: ['task-4'],
    });
    expect(approvalBatchOutcome(result, 'task-1')).toBe('APPROVED');
    expect(approvalBatchOutcome(result, 'task-2')).toBe('INELIGIBLE');
    expect(approvalBatchOutcome(result, 'task-3')).toBe('FAILED');
    expect(approvalBatchOutcome(result, 'task-4')).toBe('NOT_ATTEMPTED');
    expect(loadTask.mock.calls.map(([taskId]) => taskId)).toEqual(['task-1', 'task-2', 'task-3']);
    expect(approveTask).toHaveBeenCalledTimes(2);
  });

  it.each([
    [403, 'AUTHORITY_DENIED', false],
    [409, 'VERSION_CONFLICT', true],
    [503, 'SERVICE_UNAVAILABLE', true],
    [0, 'UNKNOWN', false],
  ] as const)(
    'records a non-sensitive failure cause for status %s',
    async (status, reason, retryable) => {
      const approveTask = vi.fn(async () => {
        throw status === 0 ? new Error('raw upstream body') : { status, body: 'do not retain' };
      });

      const result = await executeSequentialApprovalBatch({
        taskIds: ['task-1', 'task-2'],
        loadTask: async (taskId) => detail(taskId),
        approveTask,
      });

      expect(result.failure).toEqual({
        taskId: 'task-1',
        phase: 'DECISION',
        reason,
        retryable,
      });
      expect(JSON.stringify(result)).not.toContain('raw upstream body');
      expect(JSON.stringify(result)).not.toContain('do not retain');
    }
  );

  it('retries only the failed and interrupted items and merges their new ledger', () => {
    const previous = {
      requestedTaskIds: ['task-1', 'task-2', 'task-3', 'task-4'],
      approvedTaskIds: ['task-1'],
      ineligibleTaskIds: ['task-2'],
      failedTaskId: 'task-3',
      failure: {
        taskId: 'task-3',
        phase: 'DECISION',
        reason: 'VERSION_CONFLICT',
        retryable: true,
      },
      remainingTaskIds: ['task-4'],
    } as const;

    expect(approvalBatchRetryTaskIds(previous)).toEqual(['task-3', 'task-4']);
    expect(
      mergeApprovalBatchRetryResult(previous, {
        requestedTaskIds: ['task-3', 'task-4'],
        approvedTaskIds: ['task-3'],
        ineligibleTaskIds: ['task-4'],
        remainingTaskIds: [],
      })
    ).toEqual({
      requestedTaskIds: previous.requestedTaskIds,
      approvedTaskIds: ['task-1', 'task-3'],
      ineligibleTaskIds: ['task-2', 'task-4'],
      failedTaskId: undefined,
      failure: undefined,
      remainingTaskIds: [],
    });
  });

  it('never offers a new command for denied or unknown outcomes', () => {
    for (const reason of ['AUTHORITY_DENIED', 'UNKNOWN'] as const) {
      expect(
        approvalBatchRetryTaskIds({
          requestedTaskIds: ['task-1', 'task-2'],
          approvedTaskIds: [],
          ineligibleTaskIds: [],
          failedTaskId: 'task-1',
          failure: {
            taskId: 'task-1',
            phase: 'DECISION',
            reason,
            retryable: false,
          },
          remainingTaskIds: ['task-2'],
        })
      ).toEqual([]);
    }
  });

  it('caps the recorded batch result to the same twenty-item execution boundary', async () => {
    const taskIds = Array.from({ length: 24 }, (_, index) => `task-${index + 1}`);
    const loadTask = vi.fn(async (taskId: string) => detail(taskId));
    const approveTask = vi.fn(async () => undefined);

    await expect(
      executeSequentialApprovalBatch({
        taskIds,
        loadTask,
        approveTask,
      })
    ).resolves.toMatchObject({
      requestedTaskIds: taskIds.slice(0, 20),
      approvedTaskIds: taskIds.slice(0, 20),
      remainingTaskIds: [],
    });
    expect(loadTask).toHaveBeenCalledTimes(20);
    expect(approveTask).toHaveBeenCalledTimes(20);
  });
});
