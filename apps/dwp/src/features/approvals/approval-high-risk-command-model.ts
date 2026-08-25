import type {
  ProductSurfaceSecureMutationAuthority,
  ProductSurfaceEvaluationData,
  ProductSurfaceStepUpChallengeData,
  ProductSurfaceStepUpChallengeRequest,
  ProductSurfaceStepUpContinuationData,
} from '@dwp-frontend/shared-utils';

export type ApprovalHighRiskOperation =
  | 'WORKFLOW_PUBLISH'
  | 'FORM_PUBLISH'
  | 'POLICY_PUBLISH'
  | 'DELIVERY_RETRY'
  | 'HCM_ORG_PUBLISH'
  | 'HCM_EXPORT_CREATE'
  | 'HCM_EXPORT_RETRY'
  | 'HCM_INTEGRATION_CONFIGURATION_CHECK'
  | 'HCM_INTEGRATION_EXECUTE'
  | 'HCM_INTEGRATION_RETRY'
  | 'HCM_INTEGRATION_RECONCILE';

export type ApprovalHighRiskCommandDescriptor = Readonly<{
  operation: ApprovalHighRiskOperation;
  commandMethod: 'POST' | 'PATCH';
  commandPath: string;
  targetType:
    | 'WORKFLOW'
    | 'FORM'
    | 'POLICY'
    | 'OUTBOX_EVENT'
    | 'ORG_SCENARIO'
    | 'EXPORT_DATASET'
    | 'EXPORT_REQUEST'
    | 'HCM_CONNECTOR'
    | 'HCM_SYNC_RUN';
  targetId: string;
  expectedObjectVersion: number;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey?: string;
  rotateIdempotencyInCommandPayload?: boolean;
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

export const APPROVAL_HIGH_RISK_ROUTE_CONTRACT_KEY_BY_OPERATION = {
  WORKFLOW_PUBLISH: 'route.approvals.admin.workflow-publish.action',
  FORM_PUBLISH: 'route.approvals.admin.form-publish.action',
  POLICY_PUBLISH: 'route.approvals.admin.policy-publish.action',
  DELIVERY_RETRY: 'route.approvals.admin.operations.retry.action',
  HCM_ORG_PUBLISH: 'route.hcm.management.org-publish.action',
  HCM_EXPORT_CREATE: 'route.hcm.management.controlled-export-create.action',
  HCM_EXPORT_RETRY: 'route.hcm.management.controlled-export-retry.action',
  HCM_INTEGRATION_CONFIGURATION_CHECK: 'route.hcm.management.integration-execute.action',
  HCM_INTEGRATION_EXECUTE: 'route.hcm.management.integration-execute.action',
  HCM_INTEGRATION_RETRY: 'route.hcm.management.integration-execute.action',
  HCM_INTEGRATION_RECONCILE: 'route.hcm.management.integration-execute.action',
} as const satisfies Readonly<Record<ApprovalHighRiskOperation, string>>;

export const HIGH_RISK_PRODUCT_SURFACE_BY_OPERATION = {
  WORKFLOW_PUBLISH: { productKey: 'approvals', surfaceKey: 'approvals.admin' },
  FORM_PUBLISH: { productKey: 'approvals', surfaceKey: 'approvals.admin' },
  POLICY_PUBLISH: { productKey: 'approvals', surfaceKey: 'approvals.admin' },
  DELIVERY_RETRY: { productKey: 'approvals', surfaceKey: 'approvals.admin' },
  HCM_ORG_PUBLISH: { productKey: 'hcm', surfaceKey: 'hcm.management' },
  HCM_EXPORT_CREATE: { productKey: 'hcm', surfaceKey: 'hcm.management' },
  HCM_EXPORT_RETRY: { productKey: 'hcm', surfaceKey: 'hcm.management' },
  HCM_INTEGRATION_CONFIGURATION_CHECK: { productKey: 'hcm', surfaceKey: 'hcm.management' },
  HCM_INTEGRATION_EXECUTE: { productKey: 'hcm', surfaceKey: 'hcm.management' },
  HCM_INTEGRATION_RETRY: { productKey: 'hcm', surfaceKey: 'hcm.management' },
  HCM_INTEGRATION_RECONCILE: { productKey: 'hcm', surfaceKey: 'hcm.management' },
} as const satisfies Readonly<
  Record<ApprovalHighRiskOperation, { productKey: string; surfaceKey: string }>
>;

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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
  const command = attempt.descriptor.rotateIdempotencyInCommandPayload
    ? {
        ...attempt.descriptor,
        idempotencyKey,
        payload: {
          ...attempt.descriptor.payload,
          command: {
            ...((attempt.descriptor.payload.command as Readonly<Record<string, unknown>>) ?? {}),
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
      contextKey: attempt.authority.contextKey,
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
