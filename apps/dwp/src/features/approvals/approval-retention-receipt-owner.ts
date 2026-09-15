import { assertApprovalRetentionReceiptOriginal } from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type {
  ApprovalRetentionPolicy,
  ApprovalRetentionRecord,
  ApprovalRetentionRules,
} from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import type {
  ApprovalRetentionReceiptCommand,
  ApprovalRetentionReceiptMetadata,
  ApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import type { ApprovalManagementScopeBinding } from './approval-management-command-scope';
import type { ApprovalHighRiskCommandController } from './use-approval-high-risk-command';

export type RetentionReceiptCapability =
  'approvals.policy.update' | 'approvals.policy.publish' | 'approvals.operations.execute';

export type RetentionReceiptAttempt = Readonly<{
  original: ApprovalRetentionReceiptOriginal;
  binding: ApprovalManagementScopeBinding;
  authoritySnapshot: ProductSurfaceAuthoritySnapshot;
  identityFingerprint: string;
  source:
    | Readonly<{ kind: 'ABSENT_POLICY' }>
    | Readonly<{ kind: 'POLICY'; value: Readonly<ApprovalRetentionPolicy>; fingerprint: string }>
    | Readonly<{ kind: 'RECORD'; value: Readonly<ApprovalRetentionRecord>; fingerprint: string }>;
}>;

export function approvalRetentionReceiptSourceIdentity(
  source: Readonly<ApprovalRetentionPolicy | ApprovalRetentionRecord>
) {
  return JSON.stringify(source);
}

export function approvalRetentionQuerySourceReady<T>(
  state:
    | Readonly<{
        status: string;
        fetchStatus: string;
        error: unknown;
        fetchFailureCount: number;
        data?: T;
      }>
    | undefined,
  original: T,
  identity: (value: T) => string
) {
  return Boolean(
    state?.status === 'success' &&
    state.fetchStatus === 'idle' &&
    state.error == null &&
    state.fetchFailureCount === 0 &&
    state.data != null &&
    identity(state.data) === identity(original)
  );
}

export function approvalRetentionInitializeReceiptCommand(
  idempotencyKey: string
): ApprovalRetentionReceiptCommand {
  return {
    operation: 'INITIALIZE_POLICY',
    originalTargetId: null,
    body: { expectedAbsent: true, idempotencyKey },
  };
}

export function approvalRetentionSaveReceiptCommand(
  policy: Readonly<ApprovalRetentionPolicy>,
  rules: Readonly<ApprovalRetentionRules>,
  idempotencyKey: string
): ApprovalRetentionReceiptCommand {
  return {
    operation: 'SAVE_POLICY',
    originalTargetId: policy.policyId,
    body: { expectedVersion: policy.version, idempotencyKey, rules },
  };
}

export function approvalRetentionPublishReceiptCommand(
  policy: Readonly<ApprovalRetentionPolicy>,
  reviewComment: string,
  idempotencyKey: string
): ApprovalRetentionReceiptCommand {
  return {
    operation: 'PUBLISH_POLICY',
    originalTargetId: policy.policyId,
    body: { expectedVersion: policy.version, idempotencyKey, reviewComment },
  };
}

export function approvalRetentionClaimReceiptCommand(
  record: Readonly<ApprovalRetentionRecord>,
  idempotencyKey: string
): ApprovalRetentionReceiptCommand {
  return {
    operation: 'CLAIM_RECORD',
    originalTargetId: record.requestId,
    body: {
      expectedVersion: record.version,
      policyId: record.policyId,
      expectedPolicyVersion: record.policyVersion,
      expectedHoldVersion: record.holdVersion,
      inventorySha256: record.inventorySha256,
      idempotencyKey,
    },
  };
}

export function approvalRetentionReceiptCapability(
  operation: ApprovalRetentionReceiptCommand['operation']
): RetentionReceiptCapability {
  if (operation === 'CLAIM_RECORD') return 'approvals.operations.execute';
  if (operation === 'PUBLISH_POLICY') return 'approvals.policy.publish';
  return 'approvals.policy.update';
}

export function preserveApprovalRetentionReceiptAttempt(
  current: RetentionReceiptAttempt | null,
  candidate: RetentionReceiptAttempt
) {
  assertApprovalRetentionReceiptOriginal(candidate.original);
  if (current && current.original !== candidate.original)
    throw new Error('Another retention command remains uncertain');
  return current ?? candidate;
}

export function approvalRetentionReceiptAttemptMatches(
  current: RetentionReceiptAttempt | null,
  original: ApprovalRetentionReceiptOriginal
) {
  assertApprovalRetentionReceiptOriginal(original);
  return current?.original === original;
}

export function clearApprovalRetentionReceiptAttempt(
  current: RetentionReceiptAttempt | null,
  original: ApprovalRetentionReceiptOriginal
) {
  return approvalRetentionReceiptAttemptMatches(current, original) ? null : current;
}

export function approvalRetentionReceiptCommitsOriginal(
  receipt: ApprovalRetentionReceiptMetadata,
  original: ApprovalRetentionReceiptOriginal
) {
  assertApprovalRetentionReceiptOriginal(original);
  return (
    receipt.status === 'COMMITTED' &&
    receipt.operation === original.command.operation &&
    receipt.idempotencyKey === original.command.body.idempotencyKey &&
    receipt.actorUserId === original.actorUserId &&
    receipt.resourceSetKey === original.resourceSetKey &&
    receipt.originalTargetId === original.command.originalTargetId &&
    receipt.originalExpectedVersion === original.originalExpectedVersion &&
    receipt.requestBodySha256 === original.requestBodySha256 &&
    receipt.resultReferenceId.length > 0
  );
}

/** Retention UNKNOWN is receipt-only; the generic HIGH retry action must never be reachable. */
export function approvalRetentionReceiptOnlyController(
  controller: ApprovalHighRiskCommandController
): ApprovalHighRiskCommandController {
  if (controller.error !== 'command-retry') return controller;
  return Object.freeze({
    ...controller,
    error: 'command-uncertain',
    confirm: async () => undefined,
  });
}
