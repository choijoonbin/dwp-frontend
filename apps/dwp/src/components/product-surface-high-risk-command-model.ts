import type {
  ApprovalFormReviewedPublishInput,
  ProductSurfaceSecureMutationAuthority,
  ProductSurfaceEvaluationData,
  ProductSurfaceStepUpChallengeData,
  ProductSurfaceStepUpChallengeRequest,
  ProductSurfaceStepUpContinuationData,
} from '@dwp-frontend/shared-utils';
import {
  approvalFormWorkspaceId,
  assertApprovalFormWorkspaceRevisionInput,
  snapshotApprovalFormWorkspace,
} from '@dwp-frontend/shared-utils/api/approval-form-workspace-contract';
import { approvalAttachmentId } from '@dwp-frontend/shared-utils/api/approval-attachment-contract';
import { snapshotApprovalAttachmentPolicyPublish } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';
import type { ApprovalAttachmentPolicyPublishInput } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';
import { PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG } from './product-surface-high-risk-command-catalog';
import type { ProductSurfaceHighRiskOperation } from './product-surface-high-risk-command-catalog';

export type ApprovalHighRiskOperation = ProductSurfaceHighRiskOperation;

export type ApprovalHighRiskCommandDescriptor = Readonly<{
  operation: ApprovalHighRiskOperation;
  commandMethod: 'POST' | 'PATCH';
  commandPath: string;
  targetType:
    | 'WORKFLOW'
    | 'FORM'
    | 'POLICY'
    | 'DOCUMENT_POLICY'
    | 'ATTACHMENT_POLICY'
    | 'DOCUMENT_HOLD'
    | 'RETENTION_POLICY'
    | 'RETENTION_RECORD'
    | 'APPROVAL_SIGNATURE_REQUEST'
    | 'SIGNATURE_POLICY'
    | 'EXTERNAL_SIGNATURE_REQUEST'
    | 'OUTBOX_EVENT'
    | 'OPERATION_BATCH'
    | 'APPROVAL_TASK'
    | 'ORG_SCENARIO'
    | 'EXPORT_DATASET'
    | 'EXPORT_REQUEST'
    | 'HCM_CONNECTOR'
    | 'HCM_SYNC_RUN'
    | 'DWAI_ON_CONTROL_PLANE';
  targetId: string;
  expectedObjectVersion: number;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey?: string;
  rotateIdempotencyInCommandPayload?: boolean;
  idempotencyPayloadPath?: 'ROOT';
}>;

export type ApprovalHighRiskAuthority = Readonly<{
  rolloutState: '110' | '111';
  expectedDecisionRevision: string;
  contextKey: string;
  contextScopeKey: string;
}>;

export type ApprovalHighRiskAuthorityResolution =
  | { mode: 'legacy' }
  | {
      mode: 'secure';
      authority: ApprovalHighRiskAuthority;
      directDecision: 'ALLOWED' | 'STEP_UP_REQUIRED';
    }
  | { mode: 'unavailable' };

export type ApprovalHighRiskAttemptPhase =
  | 'CONFIRM_ISSUER'
  | 'ISSUER_RETRY'
  | 'CONTINUATION_REQUIRED'
  | 'RESUME_REQUIRED'
  | 'RECONFIRM_COMMAND'
  | 'COMMAND_RETRY'
  | 'COMMAND_UNCERTAIN';

export type ApprovalHighRiskAttempt = Readonly<{
  schemaVersion: 1;
  descriptor: ApprovalHighRiskCommandDescriptor;
  authority: ApprovalHighRiskAuthority;
  idempotencyKey: string;
  phase: ApprovalHighRiskAttemptPhase;
  commandAttemptCount: 0 | 1 | 2;
  providerKey?: string;
  stepUp?: ProductSurfaceSecureMutationAuthority['stepUp'];
  continuation?: ProductSurfaceStepUpContinuationData['continuation'];
}>;

export const APPROVAL_HIGH_RISK_ROUTE_CONTRACT_KEY_BY_OPERATION = Object.fromEntries(
  PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG.map((entry) => [
    entry.operation,
    entry.routeContractKey,
  ])
) as Readonly<Record<ApprovalHighRiskOperation, string>>;

export const HIGH_RISK_PRODUCT_SURFACE_BY_OPERATION = Object.fromEntries(
  PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG.map((entry) => [
    entry.operation,
    { productKey: entry.productKey, surfaceKey: entry.surfaceKey },
  ])
) as Readonly<Record<ApprovalHighRiskOperation, { productKey: string; surfaceKey: string }>>;

export function productSurfaceHighRiskOperationBinding(operation: ApprovalHighRiskOperation) {
  const routeContractKey = APPROVAL_HIGH_RISK_ROUTE_CONTRACT_KEY_BY_OPERATION[operation];
  const target = HIGH_RISK_PRODUCT_SURFACE_BY_OPERATION[operation];
  if (!routeContractKey || !target) {
    throw new Error(`HIGH command operation is outside the application descriptor: ${operation}`);
  }
  return { routeContractKey, target };
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function safeVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function targetPath(segment: string, targetId: string, suffix: string): string {
  if (!nonBlank(targetId)) throw new Error('HIGH command target is required.');
  return `/api/approvals/v1/admin/${segment}/${encodeURIComponent(targetId)}/${suffix}`;
}

function descriptor(
  operation: ApprovalHighRiskOperation,
  targetType: ApprovalHighRiskCommandDescriptor['targetType'],
  targetId: string,
  expectedObjectVersion: number,
  commandPath: string,
  payload: Readonly<Record<string, unknown>>
): ApprovalHighRiskCommandDescriptor {
  if (!safeVersion(expectedObjectVersion)) throw new Error('HIGH command version is invalid.');
  return {
    operation,
    commandMethod: 'POST',
    commandPath,
    targetType,
    targetId,
    expectedObjectVersion,
    payload,
  };
}

export function approvalAttachmentPolicyPublishCommand(
  policyId: string,
  input: ApprovalAttachmentPolicyPublishInput
): ApprovalHighRiskCommandDescriptor {
  approvalAttachmentId(policyId);
  const payload = snapshotApprovalAttachmentPolicyPublish(input);
  return Object.freeze({
    ...descriptor(
      'ATTACHMENT_POLICY_PUBLISH',
      'ATTACHMENT_POLICY',
      policyId,
      payload.expectedVersion,
      targetPath('attachments/policies', policyId, 'publish'),
      payload
    ),
    idempotencyKey: payload.idempotencyKey,
  });
}

export function productSurfaceHighRiskCommand(input: ApprovalHighRiskCommandDescriptor) {
  if (!nonBlank(input.operation) || !nonBlank(input.targetType) || !nonBlank(input.targetId)) {
    throw new Error('HIGH command target is required.');
  }
  if (
    !safeVersion(input.expectedObjectVersion) ||
    !input.commandPath.startsWith('/api/') ||
    input.commandPath.includes('?') ||
    input.commandPath.includes('#')
  ) {
    throw new Error('HIGH command binding is invalid.');
  }
  return Object.freeze({ ...input, payload: Object.freeze({ ...input.payload }) });
}

export function approvalWorkflowPublishCommand(
  workflowId: string,
  expectedVersion: number
): ApprovalHighRiskCommandDescriptor {
  return descriptor(
    'WORKFLOW_PUBLISH',
    'WORKFLOW',
    workflowId,
    expectedVersion,
    targetPath('workflows', workflowId, 'publish'),
    { expectedVersion }
  );
}

export function approvalFormPublishCommand(
  formId: string,
  expectedVersion: number
): ApprovalHighRiskCommandDescriptor {
  return descriptor(
    'FORM_PUBLISH',
    'FORM',
    formId,
    expectedVersion,
    targetPath('forms', formId, 'publish'),
    { expectedVersion }
  );
}

export function approvalFormReviewedPublishCommand(
  formId: string,
  input: ApprovalFormReviewedPublishInput,
  idempotencyKey: string
): ApprovalHighRiskCommandDescriptor {
  approvalFormWorkspaceId(formId);
  assertApprovalFormWorkspaceRevisionInput(input);
  approvalFormWorkspaceId(input.draftFormVersionId);
  if (input.basePublishedVersionId !== null) approvalFormWorkspaceId(input.basePublishedVersionId);
  approvalFormWorkspaceId(input.reviewRequestId);
  if (
    !safeVersion(input.expectedWorkspaceRevision) ||
    !safeVersion(input.expectedReviewRequestVersion) ||
    !/^[a-f0-9]{64}$/u.test(input.schemaSha256) ||
    !/^[a-f0-9]{64}$/u.test(input.reviewContentDigest) ||
    !nonBlank(input.reviewComment) ||
    input.reviewComment !== input.reviewComment.trim() ||
    input.reviewComment.length < 10 ||
    input.reviewComment.length > 1000 ||
    hasControlCharacter(input.reviewComment) ||
    !nonBlank(idempotencyKey)
  )
    throw new Error('Reviewed form publication binding is invalid.');
  const payload = snapshotApprovalFormWorkspace({
    expectedFormRevision: input.expectedFormRevision,
    expectedWorkspaceRevision: input.expectedWorkspaceRevision,
    draftFormVersionId: input.draftFormVersionId,
    basePublishedVersionId: input.basePublishedVersionId,
    schemaSha256: input.schemaSha256,
    reviewContentDigest: input.reviewContentDigest,
    reviewRequestId: input.reviewRequestId,
    expectedReviewRequestVersion: input.expectedReviewRequestVersion,
    reviewComment: input.reviewComment,
  });
  return Object.freeze({
    ...descriptor(
      'FORM_REVIEWED_PUBLISH',
      'FORM',
      formId,
      input.expectedFormRevision,
      targetPath('forms', formId, 'publish-reviewed'),
      payload
    ),
    idempotencyKey,
  });
}

export function approvalPolicyPublishCommand(
  policyId: string,
  expectedVersion: number,
  reviewComment: string
): ApprovalHighRiskCommandDescriptor {
  return descriptor(
    'POLICY_PUBLISH',
    'POLICY',
    policyId,
    expectedVersion,
    targetPath('policies', policyId, 'publish'),
    { expectedVersion, reviewComment }
  );
}

export function approvalDeliveryRetryCommand(
  outboxId: string,
  expectedVersion: number
): ApprovalHighRiskCommandDescriptor {
  return descriptor(
    'DELIVERY_RETRY',
    'OUTBOX_EVENT',
    outboxId,
    expectedVersion,
    targetPath('operations/events', outboxId, 'retry'),
    {}
  );
}

type ApprovalOperationsVersionTarget = Readonly<{
  targetId: string;
  expectedVersion: number;
}>;

type ApprovalOperationsTaskTarget = ApprovalOperationsVersionTarget &
  Readonly<{
    assigneeUserId: number;
    assigneePersonPublicId: string;
  }>;

function nativeApprovalOperationPath(suffix: string): string {
  return `/api/approvals/v1/admin/operations/${suffix}`;
}

export function approvalDeliveryDeadLetterCommand(
  outboxId: string,
  expectedVersion: number,
  reason: string
): ApprovalHighRiskCommandDescriptor {
  return descriptor(
    'DELIVERY_DEAD_LETTER',
    'OUTBOX_EVENT',
    outboxId,
    expectedVersion,
    nativeApprovalOperationPath(`events/${encodeURIComponent(outboxId)}/dead-letter`),
    { reason }
  );
}

export function approvalDeliveryReplayCommand(
  outboxId: string,
  expectedVersion: number,
  reason: string
): ApprovalHighRiskCommandDescriptor {
  return descriptor(
    'DELIVERY_REPLAY',
    'OUTBOX_EVENT',
    outboxId,
    expectedVersion,
    nativeApprovalOperationPath(`events/${encodeURIComponent(outboxId)}/replay`),
    { reason }
  );
}

export function approvalDeliveryBatchCommand(
  operation: Extract<
    ApprovalHighRiskOperation,
    | 'DELIVERY_BATCH_RETRY'
    | 'DELIVERY_BATCH_DEAD_LETTER'
    | 'DELIVERY_BATCH_REPLAY'
    | 'DELIVERY_RECONCILE'
  >,
  operationId: string,
  items: readonly ApprovalOperationsVersionTarget[],
  reason: string
): ApprovalHighRiskCommandDescriptor {
  const suffix = {
    DELIVERY_BATCH_RETRY: 'deliveries/retry',
    DELIVERY_BATCH_DEAD_LETTER: 'deliveries/dead-letter',
    DELIVERY_BATCH_REPLAY: 'deliveries/replay',
    DELIVERY_RECONCILE: 'deliveries/reconcile',
  }[operation];
  return descriptor(
    operation,
    'OPERATION_BATCH',
    operationId,
    0,
    nativeApprovalOperationPath(suffix),
    { operationId, items: items.map((item) => ({ ...item })), reason }
  );
}

export function approvalTaskReassignCommand(
  taskId: string,
  expectedVersion: number,
  assigneeUserId: number,
  assigneePersonPublicId: string,
  reason: string
): ApprovalHighRiskCommandDescriptor {
  return descriptor(
    'TASK_REASSIGN',
    'APPROVAL_TASK',
    taskId,
    expectedVersion,
    nativeApprovalOperationPath(`tasks/${encodeURIComponent(taskId)}/reassign`),
    { assigneeUserId, assigneePersonPublicId, reason }
  );
}

export function approvalTaskBatchReassignCommand(
  operationId: string,
  items: readonly ApprovalOperationsTaskTarget[],
  reason: string
): ApprovalHighRiskCommandDescriptor {
  return descriptor(
    'TASK_BATCH_REASSIGN',
    'OPERATION_BATCH',
    operationId,
    0,
    nativeApprovalOperationPath('tasks/reassign'),
    { operationId, items: items.map((item) => ({ ...item })), reason }
  );
}

export function resolveApprovalHighRiskActionAuthority({
  rolloutState,
  evaluation,
  contextKey,
  contextScopeKey,
}: {
  rolloutState: string | undefined;
  evaluation: Pick<ProductSurfaceEvaluationData, 'decision' | 'decisionRevision'> | null;
  contextKey: string | undefined;
  contextScopeKey: string | undefined;
}): ApprovalHighRiskAuthorityResolution {
  if (rolloutState === '000' || rolloutState === '100') return { mode: 'legacy' };
  if (
    (rolloutState !== '110' && rolloutState !== '111') ||
    !evaluation ||
    (evaluation.decision !== 'ALLOWED' && evaluation.decision !== 'STEP_UP_REQUIRED') ||
    !nonBlank(evaluation.decisionRevision) ||
    !nonBlank(contextKey) ||
    !nonBlank(contextScopeKey)
  ) {
    return { mode: 'unavailable' };
  }
  return {
    mode: 'secure',
    directDecision: evaluation.decision,
    authority: {
      expectedDecisionRevision: evaluation.decisionRevision,
      rolloutState,
      contextKey,
      contextScopeKey,
    },
  };
}

export function createApprovalHighRiskAttempt(
  command: ApprovalHighRiskCommandDescriptor,
  authority: ApprovalHighRiskAuthority,
  idempotencyKey: string = command.idempotencyKey ?? globalThis.crypto.randomUUID()
): ApprovalHighRiskAttempt {
  if (!nonBlank(idempotencyKey)) throw new Error('HIGH command idempotency key is required.');
  return {
    schemaVersion: 1,
    descriptor: command,
    authority,
    idempotencyKey,
    phase: 'CONFIRM_ISSUER',
    commandAttemptCount: 0,
  };
}

export function restartApprovalHighRiskAttempt(
  attempt: ApprovalHighRiskAttempt,
  authority: ApprovalHighRiskAuthority,
  idempotencyKey: string = globalThis.crypto.randomUUID()
): ApprovalHighRiskAttempt {
  if (idempotencyKey === attempt.idempotencyKey) {
    throw new Error('A restarted HIGH command must rotate its idempotency key.');
  }
  const command =
    attempt.descriptor.idempotencyPayloadPath === 'ROOT'
      ? {
          ...attempt.descriptor,
          idempotencyKey,
          payload: { ...attempt.descriptor.payload, idempotencyKey },
        }
      : attempt.descriptor.rotateIdempotencyInCommandPayload
        ? {
            ...attempt.descriptor,
            idempotencyKey,
            payload: {
              ...attempt.descriptor.payload,
              command: {
                ...((attempt.descriptor.payload.command as Readonly<Record<string, unknown>>) ??
                  {}),
                idempotencyKey,
              },
            },
          }
        : attempt.descriptor;
  return createApprovalHighRiskAttempt(command, authority, idempotencyKey);
}

export function buildApprovalStepUpIssuerRequest(
  attempt: ApprovalHighRiskAttempt,
  returnTo?: string
): {
  request: ProductSurfaceStepUpChallengeRequest;
  expectedDecisionRevision: string;
} {
  return {
    expectedDecisionRevision: attempt.authority.expectedDecisionRevision,
    request: {
      commandMethod: attempt.descriptor.commandMethod,
      commandPath: attempt.descriptor.commandPath,
      targetType: attempt.descriptor.targetType,
      targetId: attempt.descriptor.targetId,
      expectedObjectVersion: attempt.descriptor.expectedObjectVersion,
      idempotencyKey: attempt.idempotencyKey,
      payload: attempt.descriptor.payload,
      contextScopeKey: attempt.authority.contextScopeKey,
      ...(attempt.providerKey ? { providerKey: attempt.providerKey } : {}),
      ...(returnTo ? { returnTo } : {}),
    },
  };
}

export function applyApprovalStepUpChallenge(
  attempt: ApprovalHighRiskAttempt,
  issued: ProductSurfaceStepUpChallengeData,
  serverNowMs: number
): ApprovalHighRiskAttempt {
  if (issued.decisionRevision !== attempt.authority.expectedDecisionRevision) {
    throw new Error('The issuer decision revision does not match the user-observed revision.');
  }
  const expiresAtMs = Date.parse(issued.expiresAt);
  if (
    !Number.isFinite(serverNowMs) ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= serverNowMs
  ) {
    throw new Error('The server-issued step-up challenge is expired.');
  }
  return {
    ...attempt,
    phase: 'RECONFIRM_COMMAND',
    stepUp: {
      challenge: issued.challenge,
      challengeId: issued.challengeId,
      decisionRevision: issued.decisionRevision,
      expiresAt: issued.expiresAt,
    },
    continuation: undefined,
  };
}

export function applyApprovalStepUpContinuation(
  attempt: ApprovalHighRiskAttempt,
  continuation: ProductSurfaceStepUpContinuationData
): ApprovalHighRiskAttempt {
  return {
    ...attempt,
    phase: 'CONTINUATION_REQUIRED',
    continuation: continuation.continuation,
  };
}

export function transitionApprovalHighRiskAttempt(
  attempt: ApprovalHighRiskAttempt,
  phase: 'ISSUER_RETRY' | 'RESUME_REQUIRED' | 'COMMAND_RETRY'
): ApprovalHighRiskAttempt {
  return { ...attempt, phase };
}

export function selectApprovalStepUpProvider(
  attempt: ApprovalHighRiskAttempt,
  providerKey: string
): ApprovalHighRiskAttempt {
  if (
    attempt.continuation?.type !== 'OIDC_PROVIDER_SELECTION' ||
    !attempt.continuation.providerKeys.includes(providerKey)
  ) {
    throw new Error('The selected step-up provider is unavailable.');
  }
  return {
    ...attempt,
    providerKey,
    phase: 'CONFIRM_ISSUER',
    continuation: undefined,
  };
}

export function beginApprovalHighRiskCommandExecution(
  attempt: ApprovalHighRiskAttempt,
  serverNowMs: number
): ApprovalHighRiskAttempt {
  const expiresAtMs = Date.parse(attempt.stepUp?.expiresAt ?? '');
  if (
    !attempt.stepUp ||
    attempt.stepUp.decisionRevision !== attempt.authority.expectedDecisionRevision ||
    !Number.isFinite(serverNowMs) ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= serverNowMs ||
    attempt.commandAttemptCount >= 2
  ) {
    throw new Error('The HIGH command cannot be retried again.');
  }
  return {
    ...attempt,
    commandAttemptCount: (attempt.commandAttemptCount + 1) as 1 | 2,
  };
}

export function buildApprovalHighRiskMutationContext(
  attempt: ApprovalHighRiskAttempt
): ProductSurfaceSecureMutationAuthority {
  if (!attempt.stepUp) throw new Error('A server-issued step-up challenge is required.');
  return {
    mode: 'SECURE',
    rolloutState: attempt.authority.rolloutState,
    expectedDecisionRevision: attempt.authority.expectedDecisionRevision,
    contextKey: attempt.authority.contextKey,
    contextScopeKey: attempt.authority.contextScopeKey,
    objectVersion: attempt.descriptor.expectedObjectVersion,
    idempotencyKey: attempt.idempotencyKey,
    stepUp: attempt.stepUp,
  };
}

/**
 * Diagnostic marker only. HIGH payload, context, idempotency key and bearer challenge are
 * deliberately excluded so callers cannot turn browser storage into an attempt cache.
 */
export function serializeApprovalHighRiskAttempt(attempt: ApprovalHighRiskAttempt): string {
  return JSON.stringify({
    schemaVersion: attempt.schemaVersion,
    operation: attempt.descriptor.operation,
    phase: attempt.phase,
    storagePolicy: 'IN_MEMORY_ONLY',
  });
}
