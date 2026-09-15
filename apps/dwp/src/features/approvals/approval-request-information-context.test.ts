import { describe, expect, it } from 'vitest';

import { latestApprovalInformationRequestEvent } from './approval-request-information-context';

import type { ApprovalRequestDetail, ApprovalTimelineEvent } from '@dwp-frontend/shared-utils';

const event = (
  eventId: string,
  message: string,
  occurredAt: string
): ApprovalTimelineEvent => ({
  eventId,
  eventType: 'INFORMATION_REQUESTED',
  actorType: 'USER',
  actorDisplayName: 'Reviewer',
  outcome: 'NEEDS_INFO',
  message,
  occurredAt,
});

function detail(timeline: ApprovalTimelineEvent[]): ApprovalRequestDetail {
  return {
    request: {
      requestId: 'request-1',
      requestNumber: 'APR-1',
      title: 'Request',
      summary: 'Summary',
      workflowNameKo: '결재',
      workflowNameEn: 'Approval',
      totalSteps: 2,
      status: 'NEEDS_INFO',
      priority: 'NORMAL',
      dataClassification: 'INTERNAL',
      latestInformationRequest: 'Please add evidence.',
      version: 4,
    },
    workflowId: 'workflow-1',
    formId: 'form-1',
    payload: {},
    timeline,
  };
}

describe('latest approval information request event', () => {
  it('selects only the latest exact message match', () => {
    const selected = latestApprovalInformationRequestEvent(
      detail([
        event('older', 'Please add evidence.', '2026-09-01T01:00:00Z'),
        event('other', 'Different request.', '2026-09-03T01:00:00Z'),
        event('latest', 'Please add evidence.', '2026-09-02T01:00:00Z'),
      ])
    );

    expect(selected?.eventId).toBe('latest');
  });

  it('does not infer context from a different timeline message', () => {
    expect(
      latestApprovalInformationRequestEvent(
        detail([event('other', 'Different request.', '2026-09-03T01:00:00Z')])
      )
    ).toBeUndefined();
  });
});
