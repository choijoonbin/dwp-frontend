import { describe, expect, it } from 'vitest';

import { approvalTaskToHub, serviceRequestToHub } from './work-hub-source-adapters';
import {
  projectApprovalSourceDetail,
  projectServiceSourceDetail,
} from './work-hub-source-owned-detail-model';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils/api/approval-api';
import type { ServiceRequestDetail } from '@dwp-frontend/shared-utils/api/service-center-api';

const approvalTask = {
  taskId: 'task-1',
  requestId: 'request-1',
  requestNumber: 'APR-031',
  title: 'Review purchase',
  summary: 'Review the evidence',
  workflowNameKo: '구매 승인',
  workflowNameEn: 'Purchase approval',
  stepKey: 'MANAGER_REVIEW',
  stepName: 'Manager review',
  stepSequence: 2,
  requesterName: 'Mina Kim',
  requesterOrgName: 'Operations',
  status: 'PENDING',
  priority: 'HIGH',
  dataClassification: 'CONFIDENTIAL',
  riskScore: 35,
  submittedAt: '2026-09-04T00:00:00Z',
  dueAt: null,
  version: 2,
} as const;

const fullApprovalContentAccess = {
  state: 'FULL',
  reason: 'CURRENT_AUTHORITY_VERIFIED',
  evaluatedAt: '2026-09-04T00:01:00Z',
} as const;

const serviceRequest = {
  requestId: 'service-1',
  requestNumber: 'SR-088',
  serviceKey: 'vpn-access',
  serviceNameKo: '원격접속 신청',
  serviceNameEn: 'VPN access',
  summary: 'Provide a business purpose',
  dataClassification: 'INTERNAL',
  status: 'AWAITING_REQUESTER',
  priority: 'NORMAL',
  assignedGroup: 'IT Service',
  assignedTo: null,
  submittedAt: '2026-09-04T00:00:00Z',
  slaDueAt: null,
  updatedAt: '2026-09-04T01:00:00Z',
  version: 3,
} as const;

describe('Work source-owned detail projection', () => {
  it('keeps only scalar approval values named by the authorized form schema', () => {
    const item = approvalTaskToHub(approvalTask, 'approval-inbox');
    const detail: ApprovalTaskDetail = {
      task: approvalTask,
      contentAccess: fullApprovalContentAccess,
      payload: {
        purpose: 'Customer support refresh',
        amount: 1850000,
        owner: { id: 7, displayName: 'Private object' },
        hiddenSecret: 'must not leave the source contract',
      },
      formSchema: {
        schemaVersion: 1,
        fields: [
          {
            key: 'purpose',
            labelKo: '구매 목적',
            labelEn: 'Purpose',
            type: 'TEXTAREA',
            required: true,
          },
          {
            key: 'amount',
            labelKo: '신청 금액',
            labelEn: 'Amount',
            type: 'NUMBER',
            required: true,
          },
          { key: 'owner', type: 'USER', required: false },
        ],
      },
      timeline: [],
      canClaim: false,
      canDecide: true,
      selfApprovalBlocked: false,
    };

    expect(projectApprovalSourceDetail(item, detail)).toEqual({
      kind: 'APPROVAL_TASK',
      history: [],
      fields: [
        {
          key: 'purpose',
          labelKo: '구매 목적',
          labelEn: 'Purpose',
          value: 'Customer support refresh',
        },
        {
          key: 'amount',
          labelKo: '신청 금액',
          labelEn: 'Amount',
          value: 1850000,
        },
      ],
    });
    expect(
      projectApprovalSourceDetail(item, {
        ...detail,
        contentAccess: {
          state: 'REDACTED',
          reason: 'CURRENT_PERMISSION_REVOKED',
          evaluatedAt: '2026-09-04T00:02:00Z',
        },
      })
    ).toBeNull();
    expect(
      projectApprovalSourceDetail(item, {
        ...detail,
        task: { ...detail.task, version: item.version + 1 },
      })
    ).toBeNull();
  });

  it('keeps schema-approved service values and only the latest information request note', () => {
    const item = serviceRequestToHub(serviceRequest);
    const detail: ServiceRequestDetail = {
      request: serviceRequest,
      values: { network: 'ERP read only', internalSecret: 'hidden' },
      requestSchema: {
        fields: [
          {
            key: 'network',
            labelKo: '접속 대상',
            labelEn: 'Target network',
            type: 'TEXT',
            required: true,
          },
        ],
      },
      schemaVersion: 1,
      dataClassification: 'INTERNAL',
      timeline: [
        {
          eventId: 'new',
          eventType: 'INFORMATION_REQUESTED',
          status: 'AWAITING_REQUESTER',
          actorType: 'AGENT',
          note: 'Add the project and access period.',
          occurredAt: '2026-09-04T02:00:00Z',
        },
        {
          eventId: 'old',
          eventType: 'INFORMATION_REQUESTED',
          status: 'AWAITING_REQUESTER',
          actorType: 'AGENT',
          note: 'Old request',
          occurredAt: '2026-09-04T01:00:00Z',
        },
        {
          eventId: 'private-history',
          eventType: 'INTERNAL_NOTE',
          status: 'AWAITING_REQUESTER',
          actorType: 'AGENT',
          note: 'Must remain hidden',
          occurredAt: '2026-09-04T03:00:00Z',
        },
      ],
    };

    const projection = projectServiceSourceDetail(item, detail);
    expect(projection).toMatchObject({
      kind: 'SERVICE_REQUEST',
      fields: [
        {
          key: 'network',
          labelKo: '접속 대상',
          labelEn: 'Target network',
          value: 'ERP read only',
        },
      ],
      requestedInformation: 'Add the project and access period.',
      history: [
        { id: 'old', event: 'informationRequested', message: 'Old request', actor: 'AGENT' },
        {
          id: 'new',
          event: 'informationRequested',
          message: 'Add the project and access period.',
          actor: 'AGENT',
        },
      ],
    });
    expect(JSON.stringify(projection)).not.toContain('Must remain hidden');
    expect(
      projectServiceSourceDetail(item, {
        ...detail,
        request: { ...detail.request, requestId: 'another-request' },
      })
    ).toBeNull();
  });

  it('preserves verified approval actors, past steps and messages while excluding raw IDs and internal events', () => {
    const item = approvalTaskToHub(approvalTask, 'approval-inbox');
    const detail: ApprovalTaskDetail = {
      task: approvalTask,
      contentAccess: fullApprovalContentAccess,
      payload: {},
      canClaim: false,
      canDecide: true,
      selfApprovalBlocked: false,
      timeline: [
        {
          eventId: 'decision',
          eventType: 'TASK_APPROVED',
          actorType: 'USER',
          actorId: 'private-user-id',
          actorDisplayName: ' Mina Kim ',
          stepName: ' Manager review ',
          stepSequence: 2,
          delegated: true,
          outcome: 'SUCCESS',
          message: '<script>Untrusted markup</script>\nReviewed evidence.',
          occurredAt: '2026-09-04T02:00:00Z',
        },
        {
          eventId: 'created',
          eventType: 'REQUEST_CREATED',
          actorType: 'SYSTEM',
          outcome: 'SUCCESS',
          occurredAt: '2026-09-04T01:00:00Z',
        },
        {
          eventId: 'internal',
          eventType: 'INTERNAL_NOTE',
          actorType: 'SYSTEM',
          outcome: 'SUCCESS',
          message: 'Internal owner investigation',
          occurredAt: '2026-09-04T01:30:00Z',
        },
      ],
    };
    const projection = projectApprovalSourceDetail(item, detail)!;
    expect(projection.history).toMatchObject([
      {
        id: 'created',
        actor: 'SYSTEM',
        stepName: null,
        stepSequence: null,
        delegated: false,
        message: null,
      },
      {
        id: 'decision',
        actor: 'USER',
        actorName: 'Mina Kim',
        stepName: 'Manager review',
        stepSequence: 2,
        delegated: true,
        outcome: 'SUCCESS',
        message: '<script>Untrusted markup</script>\nReviewed evidence.',
      },
    ]);
    expect(JSON.stringify(projection)).not.toContain('private-user-id');
    expect(JSON.stringify(projection)).not.toContain('Internal owner investigation');
    expect(projectApprovalSourceDetail({ ...item, version: item.version + 1 }, detail)).toBeNull();
  });

  it('rejects ambiguous identities and invalid dates without leaking unknown internal events', () => {
    const entry = {
      eventId: 'event',
      eventType: 'TASK_APPROVED',
      actorType: 'USER',
      outcome: 'SUCCESS',
      occurredAt: '2026-09-04T01:00:00Z',
    };
    const detail: ApprovalTaskDetail = {
      task: approvalTask,
      contentAccess: fullApprovalContentAccess,
      payload: {},
      canClaim: false,
      canDecide: true,
      selfApprovalBlocked: false,
      timeline: [
        entry,
        { ...entry, message: 'Conflicting duplicate' },
        ...['2026-09-04', 'invalid', '2026-02-30T01:00:00Z', '2026-09-04T24:00:00Z'].map(
          (occurredAt, index) => ({ ...entry, eventId: `invalid-${index}`, occurredAt })
        ),
        {
          ...entry,
          eventId: 'unknown',
          eventType: 'SECRET_REVIEW',
          message: 'Confidential future event',
        },
        {
          ...entry,
          eventId: 'valid',
          actorType: 'INTERNAL_ACTOR',
          actorDisplayName: null,
          stepSequence: -1,
          message: '  Safe\u0000 message  ',
        },
      ],
    };
    const projection = projectApprovalSourceDetail(
      approvalTaskToHub(approvalTask, 'approval-inbox'),
      detail
    )!;
    expect(projection.history).toHaveLength(1);
    expect(projection.history[0]).toMatchObject({
      id: 'valid',
      actor: 'UNKNOWN',
      stepSequence: null,
      message: 'Safe message',
    });
    expect(JSON.stringify(projection)).not.toContain('INTERNAL_ACTOR');
    expect(JSON.stringify(projection)).not.toContain('Confidential');
  });

  it('uses the actual service status-change event for the latest requested information and bounds long text', () => {
    const detail: ServiceRequestDetail = {
      request: serviceRequest,
      values: {},
      requestSchema: { fields: [] },
      schemaVersion: 1,
      dataClassification: 'INTERNAL',
      timeline: [
        {
          eventId: 'earlier',
          eventType: 'INFORMATION_REQUESTED',
          status: 'AWAITING_REQUESTER',
          actorType: 'USER',
          note: 'Earlier request',
          occurredAt: '2026-09-04T01:00:00Z',
        },
        {
          eventId: 'latest',
          eventType: 'STATUS_CHANGED',
          status: 'AWAITING_REQUESTER',
          actorType: 'USER',
          actorId: 987654,
          note: '추가 근거를 확인해 주세요. '.repeat(400),
          occurredAt: '2026-09-04T02:00:00+00:00',
        },
      ],
    };
    const projection = projectServiceSourceDetail(serviceRequestToHub(serviceRequest), detail)!;
    expect(projection.history.map((event) => event.id)).toEqual(['earlier', 'latest']);
    expect(projection.history[1]).toMatchObject({
      event: 'statusChanged',
      status: 'AWAITING_REQUESTER',
      actorName: null,
    });
    expect(projection.history[1].message).toHaveLength(4001);
    expect(projection).toHaveProperty('requestedInformation', projection.history[1].message);
    expect(JSON.stringify(projection)).not.toContain('987654');
  });
});
