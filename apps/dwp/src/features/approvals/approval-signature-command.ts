import { productSurfaceHighRiskCommand } from './approval-high-risk-command-model';

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
