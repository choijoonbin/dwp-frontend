import { productSurfaceHighRiskCommand } from './approval-high-risk-command-model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha = /^[a-f0-9]{64}$/;

function binding(id: string, version: number, key: string) {
  if (
    !uuid.test(id) ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(key)
  )
    throw new Error('Invalid approval retention command binding');
}

export function approvalRetentionPolicyPublishCommand(
  policyId: string,
  expectedVersion: number,
  reviewComment: string,
  idempotencyKey: string
) {
  binding(policyId, expectedVersion, idempotencyKey);
  if (
    typeof reviewComment !== 'string' ||
    reviewComment.trim().length < 10 ||
    reviewComment.length > 1000 ||
    reviewComment.includes('\0')
  )
    throw new Error('Invalid approval retention review');
  return productSurfaceHighRiskCommand({
    operation: 'RETENTION_POLICY_PUBLISH',
    commandMethod: 'POST',
    commandPath: `/api/approvals/v1/admin/retention/policies/${policyId}/publish`,
    targetType: 'RETENTION_POLICY',
    targetId: policyId,
    expectedObjectVersion: expectedVersion,
    idempotencyKey,
    idempotencyPayloadPath: 'ROOT',
    payload: { expectedVersion, idempotencyKey, reviewComment },
  });
}

export function approvalRetentionRecordClaimCommand(
  requestId: string,
  input: Readonly<{
    expectedVersion: number;
    policyId: string;
    expectedPolicyVersion: number;
    expectedHoldVersion: number;
    inventorySha256: string;
    idempotencyKey: string;
  }>
) {
  binding(requestId, input.expectedVersion, input.idempotencyKey);
  binding(input.policyId, input.expectedPolicyVersion, input.idempotencyKey);
  binding(requestId, input.expectedHoldVersion, input.idempotencyKey);
  if (!sha.test(input.inventorySha256)) throw new Error('Invalid approval retention inventory');
  const payload = {
    expectedVersion: input.expectedVersion,
    policyId: input.policyId,
    expectedPolicyVersion: input.expectedPolicyVersion,
    expectedHoldVersion: input.expectedHoldVersion,
    inventorySha256: input.inventorySha256,
    idempotencyKey: input.idempotencyKey,
  };
  return productSurfaceHighRiskCommand({
    operation: 'RETENTION_RECORD_CLAIM',
    commandMethod: 'POST',
    commandPath: `/api/approvals/v1/admin/retention/records/${requestId}/claims`,
    targetType: 'RETENTION_RECORD',
    targetId: requestId,
    expectedObjectVersion: input.expectedVersion,
    idempotencyKey: input.idempotencyKey,
    idempotencyPayloadPath: 'ROOT',
    payload,
  });
}
