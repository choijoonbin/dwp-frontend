import { APPROVAL_RELEASE15_HIGH_RISK_ROUTE_OPERATIONS } from '@dwp-frontend/shared-utils/api/approval-release15-action-contracts';

import type {
  ApprovalMutationExecution,
  ProductSurfaceStepUpChallengeData,
  ProductSurfaceStepUpChallengeRequest,
  ProductSurfaceStepUpContinuationData,
} from '@dwp-frontend/shared-utils';
import type { ApprovalAdminV2HighRiskCommand } from '@dwp-frontend/shared-utils/api/approval-admin-v2-command-api';
import type { ApprovalManagementScopeBinding } from '../approval-management-command-scope';

export const APPROVAL_ADMIN_V2_HIGH_RISK_OPERATIONS = APPROVAL_RELEASE15_HIGH_RISK_ROUTE_OPERATIONS;

const approvalAdminV2HighRiskRouteContractKeys = new Set<string>(
  APPROVAL_ADMIN_V2_HIGH_RISK_OPERATIONS.map(({ routeContractKey }) => routeContractKey)
);

export function isApprovalAdminV2HighRiskRouteContractKey(routeContractKey: string): boolean {
  return approvalAdminV2HighRiskRouteContractKeys.has(routeContractKey);
}

export type ApprovalAdminV2CommandAuthority = Readonly<{
  rolloutState: '110' | '111';
  expectedDecisionRevision: string;
  contextKey: string;
  contextScopeKey: string;
}>;

export type ApprovalAdminV2CommandPhase =
  | 'CONFIRM_ISSUER'
  | 'ISSUER_RETRY'
  | 'CONTINUATION_REQUIRED'
  | 'RESUME_REQUIRED'
  | 'RECONFIRM_COMMAND';

export type ApprovalAdminV2CommandAttempt = Readonly<{
  command: ApprovalAdminV2HighRiskCommand;
  authority: ApprovalAdminV2CommandAuthority;
  scopeBinding: ApprovalManagementScopeBinding;
  idempotencyKey: string;
  phase: ApprovalAdminV2CommandPhase;
  providerKey?: string;
  stepUp?: ProductSurfaceStepUpChallengeData;
  continuation?: ProductSurfaceStepUpContinuationData['continuation'];
}>;

function payload(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The command payload cannot be represented by the step-up issuer.');
  }
  return structuredClone(value as Record<string, unknown>);
}

export function approvalAdminV2IssuerRequest(
  attempt: ApprovalAdminV2CommandAttempt,
  returnTo?: string
): ProductSurfaceStepUpChallengeRequest {
  if (!isApprovalAdminV2HighRiskRouteContractKey(attempt.command.routeContractKey)) {
    throw new Error('The Approval command is not bound to a canonical HIGH route.');
  }
  return {
    commandMethod: attempt.command.commandMethod,
    commandPath: attempt.command.commandPath,
    targetType: attempt.command.targetType,
    targetId: attempt.command.targetId,
    expectedObjectVersion: attempt.command.expectedObjectVersion,
    idempotencyKey: attempt.idempotencyKey,
    payload: payload(attempt.command.proofPayload),
    contextKey: attempt.authority.contextKey,
    contextScopeKey: attempt.authority.contextScopeKey,
    ...(attempt.providerKey ? { providerKey: attempt.providerKey } : {}),
    ...(returnTo ? { returnTo } : {}),
  };
}

export function approvalAdminV2SecureExecution(
  attempt: ApprovalAdminV2CommandAttempt
): ApprovalMutationExecution {
  if (
    !attempt.stepUp ||
    attempt.stepUp.decisionRevision !== attempt.authority.expectedDecisionRevision
  ) {
    throw new Error('Current command-bound step-up evidence is required.');
  }
  return {
    mode: 'SECURE',
    rolloutState: attempt.authority.rolloutState,
    expectedDecisionRevision: attempt.authority.expectedDecisionRevision,
    contextKey: attempt.authority.contextKey,
    contextScopeKey: attempt.authority.contextScopeKey,
    objectVersion: attempt.command.expectedObjectVersion,
    idempotencyKey: attempt.idempotencyKey,
    stepUp: {
      challenge: attempt.stepUp.challenge,
      challengeId: attempt.stepUp.challengeId,
      decisionRevision: attempt.stepUp.decisionRevision,
      expiresAt: attempt.stepUp.expiresAt,
    },
  };
}
