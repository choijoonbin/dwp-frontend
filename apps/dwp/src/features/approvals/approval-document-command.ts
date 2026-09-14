import { productSurfaceHighRiskCommand } from './approval-high-risk-command-model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function input(id: string, version: number, reviewComment: string, key: string) {
  if (
    !uuid.test(id) ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    reviewComment.trim().length < 10 ||
    reviewComment.length > 1000 ||
    reviewComment.includes('\0') ||
    !/^[A-Za-z0-9._:-]{1,120}$/.test(key)
  )
    throw new Error('Invalid approval document publication binding');
}
export function approvalDocumentPolicyPublishCommand(
  policyId: string,
  expectedVersion: number,
  reviewComment: string,
  idempotencyKey: string
) {
  input(policyId, expectedVersion, reviewComment, idempotencyKey);
  return productSurfaceHighRiskCommand({
    operation: 'DOCUMENT_POLICY_PUBLISH',
    commandMethod: 'POST',
    commandPath: `/api/approvals/v1/admin/document-tools/policies/${policyId}/publish`,
    targetType: 'DOCUMENT_POLICY',
    targetId: policyId,
    expectedObjectVersion: expectedVersion,
    idempotencyKey,
    idempotencyPayloadPath: 'ROOT',
    payload: { expectedVersion, reviewComment, idempotencyKey },
  });
}
export function approvalDocumentHoldPublishCommand(
  requestId: string,
  expectedVersion: number,
  proposalId: string,
  reviewComment: string,
  idempotencyKey: string
) {
  input(requestId, expectedVersion, reviewComment, idempotencyKey);
  if (!uuid.test(proposalId)) throw new Error('Invalid approval document hold proposal');
  return productSurfaceHighRiskCommand({
    operation: 'DOCUMENT_HOLD_PUBLISH',
    commandMethod: 'POST',
    commandPath: `/api/approvals/v1/admin/document-tools/holds/${requestId}/publish`,
    targetType: 'DOCUMENT_HOLD',
    targetId: requestId,
    expectedObjectVersion: expectedVersion,
    idempotencyKey,
    idempotencyPayloadPath: 'ROOT',
    payload: { expectedVersion, proposalId, reviewComment, idempotencyKey },
  });
}
