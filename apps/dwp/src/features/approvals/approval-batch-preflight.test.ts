import { describe, expect, it } from 'vitest';

import {
  approvalBatchEligibleTaskIds,
  buildApprovalBatchPreflight,
  mergeApprovalBatchPreflightResult,
} from './approval-batch-preflight';

import type { ApprovalTask, ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

function task(taskId: string, version = 1): ApprovalTask {
  return {
    taskId,
    requestId: `request-${taskId}`,
    requestNumber: `APR-${taskId}`,
    title: `Request ${taskId}`,
    summary: '',
    workflowNameKo: '일반 결재',
    workflowNameEn: 'General approval',
    stepKey: 'REVIEW',
    stepName: 'Review',
    stepSequence: 1,
    status: 'PENDING',
    priority: 'NORMAL',
    dataClassification: 'INTERNAL',
    riskScore: 20,
    version,
  };
}

function detail(taskId: string, overrides: Partial<ApprovalTaskDetail> = {}): ApprovalTaskDetail {
  return {
    task: task(taskId),
    contentAccess: {
      state: 'FULL',
      reason: 'CURRENT_AUTHORITY_VERIFIED',
      evaluatedAt: '2026-09-15T00:00:00Z',
    },
    payload: {},
    timeline: [],
    canClaim: false,
    canDecide: true,
    selfApprovalBlocked: false,
    ...overrides,
  };
}

describe('approval batch preflight', () => {
  it('separates eligible, excluded, and uncertain work without inferring authority', () => {
    const selectedTaskIds = [
      'ready',
      'no-authority',
      'self',
      'redacted',
      'loading',
      'changed',
      'missing',
    ];
    const queueTasks = selectedTaskIds
      .filter((taskId) => taskId !== 'missing')
      .map((taskId) => task(taskId));

    const result = buildApprovalBatchPreflight({
      selectedTaskIds,
      queueTasks,
      inspections: [
        { taskId: 'ready', state: 'READY', detail: detail('ready') },
        {
          taskId: 'no-authority',
          state: 'READY',
          detail: detail('no-authority', { canDecide: false }),
        },
        {
          taskId: 'self',
          state: 'READY',
          detail: detail('self', { selfApprovalBlocked: true }),
        },
        {
          taskId: 'redacted',
          state: 'READY',
          detail: detail('redacted', {
            contentAccess: {
              state: 'REDACTED',
              reason: 'CURRENT_PERMISSION_REVOKED',
              evaluatedAt: '2026-09-15T00:00:00Z',
            },
          }),
        },
        { taskId: 'loading', state: 'LOADING' },
        {
          taskId: 'changed',
          state: 'READY',
          detail: { ...detail('changed'), task: task('changed', 2) },
        },
      ],
    });

    expect(result).toMatchObject({
      selectedCount: 7,
      eligibleCount: 1,
      excludedCount: 3,
      recheckCount: 3,
    });
    expect(result.entries.map(({ taskId, outcome, reason }) => [taskId, outcome, reason])).toEqual([
      ['ready', 'ELIGIBLE', undefined],
      ['no-authority', 'EXCLUDED', 'DECISION_AUTHORITY_UNAVAILABLE'],
      ['self', 'EXCLUDED', 'SELF_APPROVAL_BLOCKED'],
      ['redacted', 'EXCLUDED', 'CONTENT_ACCESS_DENIED'],
      ['loading', 'RECHECK', 'DETAIL_LOADING'],
      ['changed', 'RECHECK', 'QUEUE_CHANGED'],
      ['missing', 'RECHECK', 'QUEUE_CHANGED'],
    ]);
    expect(approvalBatchEligibleTaskIds(result)).toEqual(['ready']);
  });

  it('treats an explicit read denial as excluded and a transport failure as uncertain', () => {
    const queueTasks = [task('denied'), task('unavailable')];
    const result = buildApprovalBatchPreflight({
      selectedTaskIds: queueTasks.map(({ taskId }) => taskId),
      queueTasks,
      inspections: [
        { taskId: 'denied', state: 'ERROR', denied: true },
        { taskId: 'unavailable', state: 'ERROR' },
      ],
    });

    expect(result.entries.map(({ outcome, reason }) => [outcome, reason])).toEqual([
      ['EXCLUDED', 'CONTENT_ACCESS_DENIED'],
      ['RECHECK', 'DETAIL_UNAVAILABLE'],
    ]);
  });

  it('retains preflight exclusions in the final auditable batch result', () => {
    const preflight = buildApprovalBatchPreflight({
      selectedTaskIds: ['ready', 'denied'],
      queueTasks: [task('ready'), task('denied')],
      inspections: [
        { taskId: 'ready', state: 'READY', detail: detail('ready') },
        { taskId: 'denied', state: 'READY', detail: detail('denied', { canDecide: false }) },
      ],
    });

    expect(
      mergeApprovalBatchPreflightResult(preflight, {
        requestedTaskIds: ['ready'],
        approvedTaskIds: ['ready'],
        ineligibleTaskIds: [],
        remainingTaskIds: [],
      })
    ).toEqual({
      requestedTaskIds: ['ready', 'denied'],
      approvedTaskIds: ['ready'],
      ineligibleTaskIds: ['denied'],
      remainingTaskIds: [],
    });
  });
});
