import { describe, expect, it } from 'vitest';

import { approvalCompletedDecisionRecord } from './approval-completed-decision';

import type { ApprovalTaskDetail, ApprovalTimelineEvent } from '@dwp-frontend/shared-utils';

const event = (change: Partial<ApprovalTimelineEvent> = {}): ApprovalTimelineEvent => ({
  eventId: 'event-1',
  eventType: 'TASK_APPROVED',
  actorType: 'USER',
  actorId: '42',
  actorDisplayName: 'Jihun Park',
  stepName: 'Security review',
  stepSequence: 2,
  delegated: false,
  outcome: 'SUCCESS',
  message: 'Approved after evidence review.',
  occurredAt: '2026-09-15T01:00:00Z',
  ...change,
});

const detail = (change: Partial<ApprovalTaskDetail> = {}): ApprovalTaskDetail => ({
  task: {
    taskId: 'task-1',
    requestId: 'request-1',
    requestNumber: 'APR-001',
    title: 'Production access extension',
    summary: 'Review current evidence.',
    workflowNameKo: '접근 검토',
    workflowNameEn: 'Access review',
    stepKey: 'SECURITY',
    stepName: 'Security review',
    stepSequence: 2,
    status: 'APPROVED',
    priority: 'HIGH',
    dataClassification: 'CONFIDENTIAL',
    riskScore: 72,
    version: 4,
  },
  contentAccess: {
    state: 'FULL',
    reason: 'CURRENT_AUTHORITY_VERIFIED',
    evaluatedAt: '2026-09-15T01:00:01Z',
  },
  payload: {},
  timeline: [event()],
  canClaim: false,
  canDecide: false,
  selfApprovalBlocked: false,
  ...change,
});

describe('approval completed decision evidence', () => {
  it('selects the latest successful event for the exact completed task stage', () => {
    const older = event({ eventId: 'older', occurredAt: '2026-09-14T01:00:00Z' });
    const latest = event({ eventId: 'latest', occurredAt: '2026-09-15T01:00:00Z' });
    expect(approvalCompletedDecisionRecord(detail({ timeline: [older, latest] }))).toEqual({
      decision: 'APPROVED',
      event: latest,
    });
  });

  it('uses the matching rejection event for a rejected task', () => {
    const rejected = event({ eventType: 'TASK_REJECTED', eventId: 'rejected' });
    expect(
      approvalCompletedDecisionRecord(
        detail({ task: { ...detail().task, status: 'REJECTED' }, timeline: [rejected] })
      )
    ).toEqual({ decision: 'REJECTED', event: rejected });
  });

  it.each([
    event({ stepSequence: 1 }),
    event({ outcome: 'FAILED' }),
    event({ occurredAt: 'invalid' }),
    event({ eventType: 'REQUEST_SUBMITTED' }),
  ])('does not infer decision evidence from a non-matching timeline event', (candidate) => {
    expect(approvalCompletedDecisionRecord(detail({ timeline: [candidate] }))).toBeUndefined();
  });
});
