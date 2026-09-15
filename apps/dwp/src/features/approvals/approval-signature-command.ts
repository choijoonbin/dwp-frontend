import { productSurfaceHighRiskCommand } from './approval-high-risk-command-model';
import {
  snapshotApprovalExternalSignatureCommandInput,
  type ApprovalExternalSignatureCommandInput,
} from '@dwp-frontend/shared-utils/api/approval-external-signature-contract';
import {
  snapshotApprovalSignaturePolicyPublishInput,
  type ApprovalSignaturePolicyPublishInput,
} from '@dwp-frontend/shared-utils/api/approval-signature-policy-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function approvalSignatureSignCommand(
  signatureRequestId: string,
  input: Readonly<{
    expectedVersion: number;
    sourceDigest: string;
    consentReceiptId: string;
    idempotencyKey: string;
  }>
) {
  if (
    !uuid.test(signatureRequestId) ||
    !uuid.test(input.consentReceiptId) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    !/^[a-f0-9]{64}$/.test(input.sourceDigest) ||
    !/^[A-Za-z0-9._:-]{1,120}$/.test(input.idempotencyKey)
  )
    throw new Error('Invalid approval signature command binding');
  return productSurfaceHighRiskCommand({
    operation: 'SIGNATURE_SIGN',
    commandMethod: 'POST',
    commandPath: `/api/approvals/v1/signature-requests/${signatureRequestId}/sign`,
    targetType: 'APPROVAL_SIGNATURE_REQUEST',
    targetId: signatureRequestId,
    expectedObjectVersion: input.expectedVersion,
    idempotencyKey: input.idempotencyKey,
    idempotencyPayloadPath: 'ROOT',
    payload: {
      expectedVersion: input.expectedVersion,
      sourceDigest: input.sourceDigest,
      consentReceiptId: input.consentReceiptId,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export function approvalSignaturePolicyPublishCommand(
  policyId: string,
  input: ApprovalSignaturePolicyPublishInput
) {
  if (!uuid.test(policyId)) throw new Error('Invalid signature policy command target');
  const payload = snapshotApprovalSignaturePolicyPublishInput(input);
  return productSurfaceHighRiskCommand({
    operation: 'SIGNATURE_POLICY_PUBLISH',
    commandMethod: 'POST',
    commandPath: `/api/approvals/v1/admin/signatures/policies/${policyId}/publish`,
    targetType: 'SIGNATURE_POLICY',
    targetId: policyId,
    expectedObjectVersion: payload.expectedVersion,
    idempotencyKey: payload.idempotencyKey,
    idempotencyPayloadPath: 'ROOT',
    payload,
  });
}

export function approvalExternalSignatureHandoverCommand(
  signatureRequestId: string,
  input: ApprovalExternalSignatureCommandInput
) {
  if (!uuid.test(signatureRequestId)) throw new Error('Invalid external signature command target');
  const payload = snapshotApprovalExternalSignatureCommandInput(input);
  return productSurfaceHighRiskCommand({
    operation: 'EXTERNAL_SIGNATURE_HANDOVER',
    commandMethod: 'POST',
    commandPath: `/api/approvals/v1/external-signature-requests/${signatureRequestId}/handovers`,
    targetType: 'EXTERNAL_SIGNATURE_REQUEST',
    targetId: signatureRequestId,
    expectedObjectVersion: payload.expectedVersion,
    idempotencyKey: payload.idempotencyKey,
    idempotencyPayloadPath: 'ROOT',
    payload,
  });
}
