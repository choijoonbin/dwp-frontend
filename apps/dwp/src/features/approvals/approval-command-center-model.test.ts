import { describe, expect, it, vi } from 'vitest';

import {
  APPROVAL_QUEUE_FILTERS,
  approvalQueueCounts,
  buildApprovalDecisionSignals,
  buildApprovalWorkflowEvidence,
  executeSequentialApprovalBatch,
  filterApprovalTasks,
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
    payload: {},
    timeline: [],
    canClaim: false,
    canDecide,
    selfApprovalBlocked: false,
  };
}

describe('approval command center model', () => {
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

    await expect(
      executeSequentialApprovalBatch({
        taskIds: ['task-1', 'task-2', 'task-3', 'task-4'],
        loadTask,
        approveTask,
      })
    ).resolves.toEqual({
      approvedTaskIds: ['task-1'],
      ineligibleTaskIds: ['task-2'],
      failedTaskId: 'task-3',
      remainingTaskIds: ['task-4'],
    });
    expect(loadTask.mock.calls.map(([taskId]) => taskId)).toEqual(['task-1', 'task-2', 'task-3']);
    expect(approveTask).toHaveBeenCalledTimes(2);
  });
});
