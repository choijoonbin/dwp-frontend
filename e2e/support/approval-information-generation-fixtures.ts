import { compileApprovalTypedForm } from '../../apps/dwp/src/features/approvals/approval-form-typed-compiler';

import { APPROVAL_REQUEST_FIXTURE } from './product-area-fixtures';

import type {
  ApprovalInformationRound,
  ApprovalRequestDetail,
  ApprovalTypedFormSchema,
} from '@dwp-frontend/shared-utils';

export const INFORMATION_SCHEMA: ApprovalTypedFormSchema = {
  schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
  schemaVersion: 2,
  fields: [
    { key: 'summary', type: 'TEXTAREA', labelKo: '요청 내용', labelEn: 'Summary', required: true },
    {
      key: 'costCenter',
      type: 'TEXT',
      labelKo: '비용 센터',
      labelEn: 'Cost center',
      required: true,
    },
  ],
};

export const ORIGINAL_INFORMATION_USER = {
  personPublicId: '82000000-0000-4000-8000-000000000001',
  displayName: '김결재',
};
export const OTHER_INFORMATION_USER = {
  personPublicId: '82000000-0000-4000-8000-000000000002',
  displayName: '김다른',
};

export async function approvalInformationDetail(withUser = false): Promise<ApprovalRequestDetail> {
  const schema: ApprovalTypedFormSchema = withUser
    ? {
        ...INFORMATION_SCHEMA,
        fields: [
          ...INFORMATION_SCHEMA.fields,
          { key: 'reviewer', type: 'USER', labelKo: '검토자', labelEn: 'Reviewer', required: true },
        ],
      }
    : INFORMATION_SCHEMA;
  const compiled = await compileApprovalTypedForm(schema);
  return {
    request: {
      ...APPROVAL_REQUEST_FIXTURE,
      requestId: '81000000-0000-4000-8000-000000000001',
      status: 'NEEDS_INFO',
      version: 3,
      summary: '원래 요청 내용',
      latestInformationRequest: '비용 센터를 보완해 주세요.',
    },
    formId: '81000000-0000-4000-8000-000000000002',
    formVersionId: '81000000-0000-4000-8000-000000000003',
    formSchemaSha256: compiled.schemaSha256,
    workflowId: '81000000-0000-4000-8000-000000000004',
    formSchema: schema,
    payload: {
      summary: '원래 요청 내용',
      costCenter: 'original-center',
      ...(withUser ? { reviewer: ORIGINAL_INFORMATION_USER.personPublicId } : {}),
    },
    timeline: [],
    informationGeneration: 1,
    informationRound: {
      roundId: '81000000-0000-4000-8000-000000000005',
      sourceGeneration: 1,
      targetGeneration: 2,
      pins: {
        workflowVersionId: '81000000-0000-4000-8000-000000000006',
        workflowVersion: 2,
        workflowDefinitionSha256: 'a'.repeat(64),
        formSchemaSha256: compiled.schemaSha256,
        policyVersion: 4,
        policySha256: 'b'.repeat(64),
      },
      payloadRevision: 2,
      payloadSha256: 'c'.repeat(64),
    },
  };
}

function withRound(
  detail: ApprovalRequestDetail,
  change: (round: ApprovalInformationRound) => ApprovalInformationRound
): ApprovalRequestDetail {
  if (!detail.informationRound) throw new Error('Test information round is missing.');
  return { ...detail, informationRound: change(detail.informationRound) };
}

export const INFORMATION_SOURCE_CHANGES: ReadonlyArray<{
  key: string;
  change: (detail: ApprovalRequestDetail) => ApprovalRequestDetail;
}> = [
  {
    key: 'requestId',
    change: (d) => ({
      ...d,
      request: { ...d.request, requestId: '81000000-0000-4000-8000-000000000007' },
    }),
  },
  { key: 'requestVersion', change: (d) => ({ ...d, request: { ...d.request, version: 4 } }) },
  { key: 'informationGeneration', change: (d) => ({ ...d, informationGeneration: 2 }) },
  {
    key: 'roundId',
    change: (d) => withRound(d, (r) => ({ ...r, roundId: '81000000-0000-4000-8000-000000000008' })),
  },
  { key: 'sourceGeneration', change: (d) => withRound(d, (r) => ({ ...r, sourceGeneration: 2 })) },
  { key: 'targetGeneration', change: (d) => withRound(d, (r) => ({ ...r, targetGeneration: 3 })) },
  {
    key: 'workflowVersionId',
    change: (d) =>
      withRound(d, (r) => ({
        ...r,
        pins: { ...r.pins, workflowVersionId: '81000000-0000-4000-8000-000000000009' },
      })),
  },
  {
    key: 'workflowVersion',
    change: (d) => withRound(d, (r) => ({ ...r, pins: { ...r.pins, workflowVersion: 3 } })),
  },
  {
    key: 'workflowDefinitionSha256',
    change: (d) =>
      withRound(d, (r) => ({
        ...r,
        pins: { ...r.pins, workflowDefinitionSha256: 'd'.repeat(64) },
      })),
  },
  {
    key: 'formSchemaSha256',
    change: (d) =>
      withRound(d, (r) => ({ ...r, pins: { ...r.pins, formSchemaSha256: 'd'.repeat(64) } })),
  },
  {
    key: 'policyVersion',
    change: (d) => withRound(d, (r) => ({ ...r, pins: { ...r.pins, policyVersion: 5 } })),
  },
  {
    key: 'policySha256',
    change: (d) =>
      withRound(d, (r) => ({ ...r, pins: { ...r.pins, policySha256: 'd'.repeat(64) } })),
  },
  { key: 'payloadRevision', change: (d) => withRound(d, (r) => ({ ...r, payloadRevision: 3 })) },
  {
    key: 'payloadSha256',
    change: (d) => withRound(d, (r) => ({ ...r, payloadSha256: 'd'.repeat(64) })),
  },
];
