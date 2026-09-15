import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  approvalHighRiskMutationExecutionConfig,
  approvalMutationExecutionConfig,
  type ApprovalMutationExecution,
} from './approval-governed-mutation';
import {
  readApprovalExternalSignatureArtifact,
  readApprovalExternalSignatureAudit,
  readApprovalExternalSignatureContext,
  readApprovalExternalSignatureReceipt,
  readApprovalExternalSignatureRequest,
  snapshotApprovalExternalSignatureCommandInput,
  snapshotApprovalExternalSignatureCreateInput,
  type ApprovalExternalSignatureArtifact,
  type ApprovalExternalSignatureAudit,
  type ApprovalExternalSignatureCommandInput,
  type ApprovalExternalSignatureContext,
  type ApprovalExternalSignatureCreateInput,
  type ApprovalExternalSignatureReceipt,
  type ApprovalExternalSignatureRequest,
} from './approval-external-signature-contract';
import {
  diagnosticId,
  invalidSignatureDiagnostics,
} from './approval-signature-diagnostics-primitives';

const base = '/api/approvals/v1';

export type ApprovalExternalSignatureReadAuthority = Readonly<{
  contextScopeKey: string;
  expectedDecisionRevision: string;
  beforeDispatch?: () => void;
}>;

export type ApprovalExternalSignaturePinnedAuthority = ApprovalExternalSignatureReadAuthority &
  Readonly<{
    resourceSetKey: string;
    requestId: string;
    requestVersion: number;
    sourceRevision: string;
    sourceSha256: string;
    beforeDispatch: () => void;
  }>;

export class ApprovalExternalSignatureResponseError extends Error {
  constructor(cause: unknown) {
    super('External signature command returned an unverifiable result.', { cause });
    this.name = 'ApprovalExternalSignatureResponseError';
  }
}

function assertReadAuthority(authority: ApprovalExternalSignatureReadAuthority) {
  if (
    !authority.contextScopeKey.trim() ||
    authority.contextScopeKey.length > 512 ||
    !/^psr-[a-f0-9]{64}$/.test(authority.expectedDecisionRevision)
  )
    invalidSignatureDiagnostics();
}

function assertPinnedAuthority(authority: ApprovalExternalSignaturePinnedAuthority) {
  assertReadAuthority(authority);
  diagnosticId(authority.requestId);
  if (
    !Number.isSafeInteger(authority.requestVersion) ||
    authority.requestVersion < 0 ||
    !/^RS_[A-Z0-9_]{1,76}$/.test(authority.resourceSetKey) ||
    !/^[a-f0-9]{64}$/.test(authority.sourceSha256) ||
    authority.sourceRevision !== `sigp-${authority.sourceSha256}`
  )
    invalidSignatureDiagnostics();
}

function assertScope(
  value: Pick<ApprovalExternalSignatureContext | ApprovalExternalSignatureRequest, 'scope'>,
  authority: ApprovalExternalSignatureReadAuthority
) {
  if (
    value.scope.contextScopeKey !== authority.contextScopeKey ||
    value.scope.decisionRevision !== authority.expectedDecisionRevision
  )
    invalidSignatureDiagnostics();
}

function assertSource(
  value: Pick<
    ApprovalExternalSignatureContext | ApprovalExternalSignatureRequest,
    'scope' | 'source'
  >,
  authority: ApprovalExternalSignaturePinnedAuthority
) {
  assertScope(value, authority);
  if (
    value.scope.resourceSetKey !== authority.resourceSetKey ||
    value.scope.sourceRevision !== authority.sourceRevision ||
    value.scope.sourceSha256 !== authority.sourceSha256 ||
    value.source.requestId !== authority.requestId ||
    value.source.requestVersion !== authority.requestVersion ||
    value.source.resourceSetKey !== authority.resourceSetKey ||
    value.source.sourceSha256 !== authority.sourceSha256
  )
    invalidSignatureDiagnostics();
}

function readOptions(authority: ApprovalExternalSignatureReadAuthority, signal?: AbortSignal) {
  assertReadAuthority(authority);
  return {
    contextScopeKey: authority.contextScopeKey,
    headers: { 'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision },
    ...(authority.beforeDispatch ? { beforeDispatch: authority.beforeDispatch } : {}),
    ...(signal ? { signal } : {}),
    timeoutMs: 10_000,
  };
}

export async function getApprovalExternalSignatureContext(
  requestId: string,
  authority: ApprovalExternalSignatureReadAuthority,
  signal?: AbortSignal
): Promise<ApprovalExternalSignatureContext> {
  diagnosticId(requestId);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base}/requests/${requestId}/external-signature-context`,
    readOptions(authority, signal)
  );
  authority.beforeDispatch?.();
  const value = readApprovalExternalSignatureContext(response.data.data);
  assertScope(value, authority);
  if (value.source.requestId !== requestId) invalidSignatureDiagnostics();
  return value;
}

export async function getApprovalExternalSignatureRequest(
  signatureRequestId: string,
  authority: ApprovalExternalSignaturePinnedAuthority,
  signal?: AbortSignal
): Promise<ApprovalExternalSignatureRequest> {
  diagnosticId(signatureRequestId);
  assertPinnedAuthority(authority);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base}/external-signature-requests/${signatureRequestId}`,
    readOptions(authority, signal)
  );
  authority.beforeDispatch();
  const value = readApprovalExternalSignatureRequest(response.data.data);
  assertSource(value, authority);
  if (value.signatureRequestId !== signatureRequestId) invalidSignatureDiagnostics();
  return value;
}

export async function getApprovalExternalSignatureAudit(
  signatureRequestId: string,
  authority: ApprovalExternalSignaturePinnedAuthority,
  signal?: AbortSignal
): Promise<ApprovalExternalSignatureAudit> {
  diagnosticId(signatureRequestId);
  assertPinnedAuthority(authority);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base}/external-signature-requests/${signatureRequestId}/audit`,
    readOptions(authority, signal)
  );
  authority.beforeDispatch();
  return readApprovalExternalSignatureAudit(response.data.data);
}

export async function getApprovalExternalSignatureArtifact(
  signatureRequestId: string,
  artifactId: string,
  authority: ApprovalExternalSignaturePinnedAuthority,
  signal?: AbortSignal
): Promise<ApprovalExternalSignatureArtifact> {
  diagnosticId(signatureRequestId);
  diagnosticId(artifactId);
  assertPinnedAuthority(authority);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base}/external-signature-requests/${signatureRequestId}/artifacts/${artifactId}`,
    readOptions(authority, signal)
  );
  authority.beforeDispatch();
  const value = readApprovalExternalSignatureArtifact(response.data.data);
  if (value.artifactId !== artifactId) invalidSignatureDiagnostics();
  return value;
}

function commandConfig(
  input: ApprovalExternalSignatureCreateInput | ApprovalExternalSignatureCommandInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalExternalSignaturePinnedAuthority,
  highRisk: boolean,
  signal?: AbortSignal
) {
  assertPinnedAuthority(authority);
  const expectedVersion =
    'expectedVersion' in input ? input.expectedVersion : input.expectedRequestVersion;
  if (
    execution.mode !== 'SECURE' ||
    execution.contextScopeKey !== authority.contextScopeKey ||
    execution.expectedDecisionRevision !== authority.expectedDecisionRevision ||
    (execution.idempotencyKey !== undefined && execution.idempotencyKey !== input.idempotencyKey) ||
    (highRisk && execution.objectVersion !== expectedVersion)
  )
    invalidSignatureDiagnostics();
  const secured = Object.freeze({ ...execution, idempotencyKey: input.idempotencyKey });
  const baseConfig = highRisk
    ? approvalHighRiskMutationExecutionConfig(secured, { objectVersionHeader: true })
    : approvalMutationExecutionConfig(secured);
  const beforeDispatch = () => {
    if (signal?.aborted) invalidSignatureDiagnostics();
    authority.beforeDispatch();
  };
  beforeDispatch();
  return {
    ...baseConfig,
    headers: {
      ...baseConfig.headers,
      'Idempotency-Key': input.idempotencyKey,
      'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision,
    },
    contextScopeKey: authority.contextScopeKey,
    beforeDispatch,
    csrfReplay: 'NEVER' as const,
    ...(signal ? { signal } : {}),
    timeoutMs: 20_000,
  };
}

function receipt(
  value: unknown,
  signatureRequestId: string | null,
  authority: ApprovalExternalSignaturePinnedAuthority
): ApprovalExternalSignatureReceipt {
  try {
    const parsed = readApprovalExternalSignatureReceipt(value);
    assertSource(parsed.signatureRequest, authority);
    if (
      signatureRequestId !== null &&
      parsed.signatureRequest.signatureRequestId !== signatureRequestId
    )
      invalidSignatureDiagnostics();
    return parsed;
  } catch (error) {
    throw new ApprovalExternalSignatureResponseError(error);
  }
}

export async function createApprovalExternalSignatureRequest(
  requestId: string,
  input: ApprovalExternalSignatureCreateInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalExternalSignaturePinnedAuthority,
  signal?: AbortSignal
) {
  diagnosticId(requestId);
  const body = snapshotApprovalExternalSignatureCreateInput(input);
  if (
    requestId !== authority.requestId ||
    body.expectedRequestVersion !== authority.requestVersion ||
    body.expectedSourceRevision !== authority.sourceRevision ||
    body.expectedSourceSha256 !== authority.sourceSha256
  )
    invalidSignatureDiagnostics();
  const config = commandConfig(body, execution, authority, false, signal);
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${base}/requests/${requestId}/external-signature-requests`,
    body,
    config
  );
  config.beforeDispatch();
  const result = receipt(response.data.data, null, authority);
  if (JSON.stringify(result.signatureRequest.provider) !== JSON.stringify(body.provider))
    invalidSignatureDiagnostics();
  return result;
}

async function command(
  operation: 'handovers' | 'refresh' | 'cancel',
  signatureRequestId: string,
  input: ApprovalExternalSignatureCommandInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalExternalSignaturePinnedAuthority,
  signal?: AbortSignal
) {
  diagnosticId(signatureRequestId);
  const body = snapshotApprovalExternalSignatureCommandInput(input);
  if (
    body.expectedSourceRevision !== authority.sourceRevision ||
    body.expectedSourceSha256 !== authority.sourceSha256
  )
    invalidSignatureDiagnostics();
  const config = commandConfig(body, execution, authority, operation === 'handovers', signal);
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${base}/external-signature-requests/${signatureRequestId}/${operation}`,
    body,
    config
  );
  config.beforeDispatch();
  return receipt(response.data.data, signatureRequestId, authority);
}

export function handoverApprovalExternalSignatureRequest(
  signatureRequestId: string,
  input: ApprovalExternalSignatureCommandInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalExternalSignaturePinnedAuthority,
  signal?: AbortSignal
) {
  return command('handovers', signatureRequestId, input, execution, authority, signal);
}

export function refreshApprovalExternalSignatureRequest(
  signatureRequestId: string,
  input: ApprovalExternalSignatureCommandInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalExternalSignaturePinnedAuthority,
  signal?: AbortSignal
) {
  return command('refresh', signatureRequestId, input, execution, authority, signal);
}

export function cancelApprovalExternalSignatureRequest(
  signatureRequestId: string,
  input: ApprovalExternalSignatureCommandInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalExternalSignaturePinnedAuthority,
  signal?: AbortSignal
) {
  return command('cancel', signatureRequestId, input, execution, authority, signal);
}
