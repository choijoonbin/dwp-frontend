import {
  readApprovalExternalSignatureContext,
  readApprovalExternalSignatureRequest,
  type ApprovalExternalSignatureContext,
  type ApprovalExternalSignatureProviderTarget,
  type ApprovalExternalSignatureRequest,
} from '@dwp-frontend/shared-utils/api/approval-external-signature-contract';
import type { SignatureProviderCard } from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function approvalExternalSignatureContextFingerprint(
  context: ApprovalExternalSignatureContext
) {
  return JSON.stringify(readApprovalExternalSignatureContext(context));
}

export function approvalExternalSignatureRequestFingerprint(
  request: ApprovalExternalSignatureRequest
) {
  return JSON.stringify(readApprovalExternalSignatureRequest(request));
}

export function approvalExternalSignatureProviderTarget(
  provider: SignatureProviderCard
): ApprovalExternalSignatureProviderTarget | null {
  if (
    !provider.providerId ||
    provider.providerVersion === null ||
    !provider.providerSha256 ||
    !provider.adapterInstalled ||
    !provider.configurationRegistered ||
    !provider.credentialRegistered ||
    !provider.credentialVerified ||
    provider.environment !== 'PRODUCTION' ||
    provider.readiness !== 'VERIFIED_PRODUCTION'
  )
    return null;
  return Object.freeze({
    providerId: provider.providerId,
    expectedProviderVersion: provider.providerVersion,
    expectedProviderSha256: provider.providerSha256,
    expectedConfiguration: Object.freeze({
      sourceId: provider.providerId,
      version: provider.providerVersion,
      sha256: provider.providerSha256,
    }),
  });
}

export function approvalExternalSignatureContextCurrent(
  context: ApprovalExternalSignatureContext,
  requestId: string,
  requestVersion: number,
  resourceSetKey: string,
  serverNowMs: number
) {
  const evaluated = Date.parse(context.evaluatedAt);
  const scopeEvaluated = Date.parse(context.scope.evaluatedAt);
  return (
    context.source.requestId === requestId &&
    context.source.requestVersion === requestVersion &&
    context.source.resourceSetKey === resourceSetKey &&
    context.scope.resourceSetKey === resourceSetKey &&
    context.scope.sourceSha256 === context.source.sourceSha256 &&
    context.scope.sourceRevision === `sigp-${context.source.sourceSha256}` &&
    Number.isFinite(serverNowMs) &&
    Number.isFinite(evaluated) &&
    Number.isFinite(scopeEvaluated) &&
    evaluated <= serverNowMs + 5_000 &&
    scopeEvaluated <= serverNowMs + 5_000
  );
}

export function approvalExternalSignatureRequestCurrent(
  request: ApprovalExternalSignatureRequest,
  context: ApprovalExternalSignatureContext
) {
  return (
    request.source.requestId === context.source.requestId &&
    request.source.requestVersion === context.source.requestVersion &&
    request.source.resourceSetKey === context.source.resourceSetKey &&
    request.source.sourceSha256 === context.source.sourceSha256 &&
    request.scope.contextScopeKey === context.scope.contextScopeKey &&
    request.scope.decisionRevision === context.scope.decisionRevision &&
    request.scope.sourceRevision === context.scope.sourceRevision &&
    request.scope.sourceSha256 === context.scope.sourceSha256
  );
}

export const approvalExternalSignatureCanHandover = (state: string) => state === 'PREPARED';
export const approvalExternalSignatureCanRefresh = (state: string) =>
  ['HANDOVER_PENDING', 'OUT_FOR_SIGNATURE', 'COMPLETION_PENDING', 'CANCEL_PENDING'].includes(state);
export const approvalExternalSignatureCanCancel = (state: string) =>
  ['PREPARED', 'HANDOVER_PENDING', 'OUT_FOR_SIGNATURE', 'COMPLETION_PENDING'].includes(state);

export function approvalExternalSignatureSessionKey(
  actorId: string,
  contextScopeKey: string,
  requestId: string
) {
  return `dwp:approval:external-signature:${actorId}:${contextScopeKey}:${requestId}`;
}

export function readApprovalExternalSignatureSessionId(value: string | null) {
  return value && uuid.test(value) ? value : null;
}
