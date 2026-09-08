import { describe, expect, it } from 'vitest';

import { buildHomeContributionModel, resolveHomeContributionProvider } from '../contributions';
import {
  approvalContributionProvider,
  workspaceWorkContributionProvider,
} from './home-contribution-providers';

import type {
  AppEntitlementPermission,
  ApprovalHome,
  ApprovalTask,
  WorkspaceWorkItem,
  WorkspaceWorkQueue,
} from '@dwp-frontend/shared-utils';

const NOW = '2026-08-25T01:00:00.000Z';
const CONTEXT = {
  now: NOW,
  snapshotAt: NOW,
  locale: 'ko-KR',
  timeZone: 'Asia/Seoul',
  translate: (key: string) => key,
};

function allow(
  resourceType: string,
  resourceKey: string,
  permissionCode = 'VIEW'
): AppEntitlementPermission {
  return { resourceType, resourceKey, permissionCode, effect: 'ALLOW' };
}

const PERMISSIONS = [
  allow('APP', 'APP.WORK'),
  allow('APP', 'APP.APPROVALS'),
  allow('ACTION', 'ACTION.APPROVAL_TASK', 'APPROVE'),
];

function approvalTask(taskId: string, requestId: string, stepKey = 'review'): ApprovalTask {
  return {
    taskId,
    requestId,
    requestNumber: `REQ-${requestId}`,
    title: '운영 로그 조회 권한 연장',
    summary: 'Finance & Risk 팀',
    workflowNameKo: '결재',
    workflowNameEn: 'Approval',
    stepKey,
    stepName: 'Review',
    stepSequence: 1,
    status: 'PENDING',
    priority: 'NORMAL',
    dataClassification: 'INTERNAL',
    riskScore: 0,
    dueAt: '2026-08-25T08:00:00.000Z',
    version: 1,
  };
}

function approvalHome(tasks: ApprovalTask[]): ApprovalHome {
  return {
    generatedAt: NOW,
    metrics: {
      pending: tasks.length,
      dueToday: 0,
      overdue: 0,
      needsInformation: 0,
      myRequestsInFlight: 0,
      averageCycleHours: 0,
      slaCompliancePercent: 100,
    },
    focusQueue: tasks,
    recentRequests: [],
    flow: [],
    insights: [],
    administrator: false,
  };
}

function workspaceItem(
  id: string,
  sourceSystem: string,
  sourceReference: string,
  obligationKey?: string
): WorkspaceWorkItem {
  return {
    workItemId: id,
    id,
    title: `Work ${id}`,
    dataClassification: 'INTERNAL',
    type: 'Approval',
    priority: 'medium',
    status: 'open',
    owner: 'me',
    dueAt: '2026-08-25T08:00:00.000Z',
    sourceSystem,
    sourceReference,
    obligationKey,
    sourceRoute: '/approvals/inbox',
    version: 1,
    updatedAt: NOW,
  };
}

function workspaceQueue(items: WorkspaceWorkItem[]): WorkspaceWorkQueue {
  return {
    summary: { total: items.length, dueSoon: 0, inProgress: 0, waiting: 0, completed: 0 },
    items,
    generatedAt: NOW,
  };
}

function approvalResult(tasks: ApprovalTask[]) {
  return resolveHomeContributionProvider(
    approvalContributionProvider,
    {
      state: 'AVAILABLE',
      generatedAt: NOW,
      data: { home: approvalHome(tasks), audience: 'MEMBER' },
    },
    CONTEXT
  );
}

function workspaceResult(items: WorkspaceWorkItem[]) {
  return resolveHomeContributionProvider(
    workspaceWorkContributionProvider,
    { state: 'AVAILABLE', generatedAt: NOW, data: workspaceQueue(items) },
    CONTEXT
  );
}

describe('Home contribution source identity regressions', () => {
  it('keeps visually identical assignments from different approval requests distinct', () => {
    const model = buildHomeContributionModel(
      [approvalResult([approvalTask('task-1', 'request-1'), approvalTask('task-2', 'request-2')])],
      { now: NOW, permissions: PERMISSIONS }
    );

    expect(model.buckets.action.map(({ dedupeKey, route }) => ({ dedupeKey, route }))).toEqual([
      { dedupeKey: 'APPROVAL:request-1', route: '/approvals/inbox?task=task-1' },
      { dedupeKey: 'APPROVAL:request-2', route: '/approvals/inbox?task=task-2' },
    ]);
  });

  it('dedupes a single task with its legacy request projection', () => {
    const model = buildHomeContributionModel(
      [
        approvalResult([approvalTask('task-1', 'request-1')]),
        workspaceResult([workspaceItem('legacy', 'Approval Service', 'request-1')]),
      ],
      { now: NOW, permissions: PERMISSIONS }
    );

    expect(model.buckets.action).toHaveLength(1);
    expect(model.buckets.action[0]).toMatchObject({
      dedupeKey: 'APPROVAL:request-1',
      duplicateCount: 2,
    });
  });

  it('separates task obligations when a request has multiple tasks and leaves a generic projection unmerged', () => {
    const tasks = [
      approvalTask('task-1', 'shared-request', 'review'),
      approvalTask('task-2', 'shared-request', 'confirmation'),
    ];
    const model = buildHomeContributionModel(
      [
        approvalResult(tasks),
        workspaceResult([
          workspaceItem('generic', 'Approval Service', 'shared-request'),
          workspaceItem('review', 'APPROVAL_TASK', 'task-1', 'review'),
          workspaceItem('confirmation', 'APPROVAL_TASK', 'task-2', 'confirmation'),
        ]),
      ],
      { now: NOW, permissions: PERMISSIONS }
    );

    expect(
      model.buckets.action.map(({ dedupeKey, duplicateCount }) => ({
        dedupeKey,
        duplicateCount,
      }))
    ).toEqual([
      { dedupeKey: 'APPROVAL_TASK:task-1:review', duplicateCount: 2 },
      { dedupeKey: 'APPROVAL_TASK:task-2:confirmation', duplicateCount: 2 },
      { dedupeKey: 'APPROVAL:shared-request', duplicateCount: 1 },
    ]);
  });
});
