import { describe, expect, it } from 'vitest';
import type {
  ApprovalRequest,
  ApprovalRequestDetail,
} from '@dwp-frontend/shared-utils/api/approval-api';
import { approvalRequestToHub } from './work-hub-source-adapters';
import { projectApprovalRequestSourceDetail } from './work-hub-source-owned-detail-model';

const request: ApprovalRequest = {
  requestId: 'requester-approval-1',
  requestNumber: 'APR-042',
  title: 'Review purchase',
  summary: 'Review the purchase details',
  workflowNameKo: '구매 승인',
  workflowNameEn: 'Purchase approval',
  currentStepKey: 'MANAGER_REVIEW',
  currentStepName: 'Manager review',
  currentStepSequence: 2,
  totalSteps: 3,
  status: 'NEEDS_INFO',
  priority: 'HIGH',
  dataClassification: 'CONFIDENTIAL',
  latestInformationRequest: 'Add the supplier comparison.',
  submittedAt: '2026-09-04T00:00:00Z',
  dueAt: null,
  completedAt: null,
  version: 3,
};
const detail: ApprovalRequestDetail = {
  request,
  workflowId: 'workflow-1',
  formId: 'form-1',
  payload: { purpose: 'Replace customer support equipment', secretInternalValue: 'private' },
  formSchema: {
    schemaVersion: 1,
    fields: [
      {
        key: 'purpose',
        type: 'TEXTAREA',
        labelKo: '구매 목적',
        labelEn: 'Purpose',
        required: true,
      },
    ],
  },
  timeline: [
    {
      eventId: 'requester-info-1',
      eventType: 'INFORMATION_REQUESTED',
      actorType: 'USER',
      actorDisplayName: 'Mina Kim',
      stepName: 'Manager review',
      stepSequence: 2,
      outcome: 'SUCCESS',
      message: 'Add the supplier comparison.',
      occurredAt: '2026-09-04T01:00:00Z',
    },
  ],
};

describe('Work requester-owned approval projection', () => {
  it('shows only authorized form fields, the current information request and recorded approval history', () => {
    const item = approvalRequestToHub(request);
    expect(projectApprovalRequestSourceDetail(item, detail)).toMatchObject({
      kind: 'APPROVAL_REQUEST',
      fields: [
        {
          key: 'purpose',
          labelKo: '구매 목적',
          labelEn: 'Purpose',
          value: 'Replace customer support equipment',
        },
      ],
      requestedInformation: 'Add the supplier comparison.',
      history: [
        {
          id: 'requester-info-1',
          actorName: 'Mina Kim',
          stepName: 'Manager review',
          stepSequence: 2,
        },
      ],
    });
    expect(JSON.stringify(projectApprovalRequestSourceDetail(item, detail))).not.toContain(
      'secretInternalValue'
    );
    expect(item.sourceRoute).toBe('/approvals/requests/needs-info?request=requester-approval-1');
  });

  it.each([
    { requestId: 'someone-elses-request' },
    { requestNumber: 'APR-another' },
    { version: 4 },
    { status: 'IN_REVIEW' as const },
    { dataClassification: 'RESTRICTED' },
    { currentStepKey: 'FINANCE_REVIEW' },
    { currentStepName: 'Finance review' },
    { currentStepSequence: 3 },
    { totalSteps: 4 },
    { workflowNameKo: '다른 결재' },
  ])('rejects source snapshot drift: %j', (patch) => {
    expect(
      projectApprovalRequestSourceDetail(approvalRequestToHub(request), {
        ...detail,
        request: { ...request, ...patch },
      })
    ).toBeNull();
  });

  it('rejects the wrong obligation and an unclassified selection', () => {
    const item = approvalRequestToHub(request);
    expect(
      projectApprovalRequestSourceDetail(
        { ...item, reference: { ...item.reference, obligationKey: 'ANOTHER_OBLIGATION' } },
        detail
      )
    ).toBeNull();
    expect(
      projectApprovalRequestSourceDetail({ ...item, dataClassification: null }, detail)
    ).toBeNull();
  });

  it('preserves missing optional source evidence as empty instead of inventing a form or future steps', () => {
    const source = {
      ...request,
      latestInformationRequest: null,
      currentStepKey: null,
      currentStepName: null,
      currentStepSequence: null,
    };
    expect(
      projectApprovalRequestSourceDetail(approvalRequestToHub(source), {
        ...detail,
        request: source,
        payload: {},
        formSchema: undefined,
        timeline: [],
      })
    ).toEqual({ kind: 'APPROVAL_REQUEST', fields: [], requestedInformation: null, history: [] });
  });
});
