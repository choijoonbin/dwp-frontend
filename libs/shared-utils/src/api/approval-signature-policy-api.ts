import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  approvalHighRiskMutationExecutionConfig,
  approvalMutationExecutionConfig,
  type ApprovalMutationExecution,
} from './approval-governed-mutation';
import {
  readSignatureProviderOverview,
  type SignatureProviderOverview,
} from './approval-signature-diagnostics-contract';
import {
  diagnosticBoolean,
  diagnosticFields,
  diagnosticId,
  diagnosticKey,
  diagnosticNullable,
  diagnosticSha,
  invalidSignatureDiagnostics,
} from './approval-signature-diagnostics-primitives';
import {
  readApprovalSignatureProviderTarget,
  type ApprovalSignatureProviderPinnedAuthority,
  type ApprovalSignatureProviderTarget,
} from './approval-signature-provider-api';
import {
  readSignatureProviderPolicyRules,
  readSignatureProviderPolicyView,
  type SignatureProviderPolicyRules,
  type SignatureProviderPolicyView,
} from './approval-signature-provider-policy-contract';

const base = '/api/approvals/v1/admin/signatures';

export type ApprovalSignaturePolicyInitializeInput = Readonly<{
  expectedAbsent: true;
  expectedSourceRevision: string;
  expectedSourceSha256: string;
  rules: SignatureProviderPolicyRules;
  idempotencyKey: string;
}>;

export type ApprovalSignaturePolicyDraftInput = Readonly<{
  expectedVersion: number;
  expectedDraftVersionId: string;
  expectedSourceRevision: string;
  expectedSourceSha256: string;
  rules: SignatureProviderPolicyRules;
  idempotencyKey: string;
}>;

export type ApprovalSignaturePolicyPublishInput = Readonly<{
  expectedVersion: number;
  expectedDraftVersionId: string;
  expectedSourceRevision: string;
  expectedSourceSha256: string;
  reviewContentSha256: string;
  idempotencyKey: string;
}>;

export type ApprovalSignatureWormInspectionInput = Readonly<{
  expectedSourceRevision: string;
  expectedSourceSha256: string;
  target: ApprovalSignatureProviderTarget;
  artifactId: string | null;
  idempotencyKey: string;
}>;

export class ApprovalSignaturePolicyResponseError extends Error {
  constructor(cause: unknown) {
    super('Approval signature policy command returned an unverifiable result.', { cause });
    this.name = 'ApprovalSignaturePolicyResponseError';
  }
}

function source(revision: unknown, sha: unknown) {
  const digest = diagnosticSha(sha);
  if (revision !== `sigp-${digest}`) invalidSignatureDiagnostics();
  return { revision: revision as string, sha: digest };
}

function version(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    invalidSignatureDiagnostics();
  return value;
}

function frozenRules(value: unknown): SignatureProviderPolicyRules {
  return Object.freeze(readSignatureProviderPolicyRules(value));
}

export function snapshotApprovalSignaturePolicyInitializeInput(
  value: ApprovalSignaturePolicyInitializeInput
): ApprovalSignaturePolicyInitializeInput {
  const fields = diagnosticFields(value, [
    'expectedAbsent',
    'expectedSourceRevision',
    'expectedSourceSha256',
    'rules',
    'idempotencyKey',
  ]);
  const pin = source(fields.expectedSourceRevision, fields.expectedSourceSha256);
  const rules = frozenRules(fields.rules);
  if (diagnosticBoolean(fields.expectedAbsent) !== true || rules.signingEnabled)
    invalidSignatureDiagnostics();
  if (rules.requiredProviderKinds.length !== 0) invalidSignatureDiagnostics();
  return Object.freeze({
    expectedAbsent: true,
    expectedSourceRevision: pin.revision,
    expectedSourceSha256: pin.sha,
    rules,
    idempotencyKey: diagnosticKey(fields.idempotencyKey),
  });
}

export function snapshotApprovalSignaturePolicyDraftInput(
  value: ApprovalSignaturePolicyDraftInput
): ApprovalSignaturePolicyDraftInput {
  const fields = diagnosticFields(value, [
    'expectedVersion',
    'expectedDraftVersionId',
    'expectedSourceRevision',
    'expectedSourceSha256',
    'rules',
    'idempotencyKey',
  ]);
  const pin = source(fields.expectedSourceRevision, fields.expectedSourceSha256);
  return Object.freeze({
    expectedVersion: version(fields.expectedVersion),
    expectedDraftVersionId: diagnosticId(fields.expectedDraftVersionId),
    expectedSourceRevision: pin.revision,
    expectedSourceSha256: pin.sha,
    rules: frozenRules(fields.rules),
    idempotencyKey: diagnosticKey(fields.idempotencyKey),
  });
}

export function snapshotApprovalSignaturePolicyPublishInput(
  value: ApprovalSignaturePolicyPublishInput
): ApprovalSignaturePolicyPublishInput {
  const fields = diagnosticFields(value, [
    'expectedVersion',
    'expectedDraftVersionId',
    'expectedSourceRevision',
    'expectedSourceSha256',
    'reviewContentSha256',
    'idempotencyKey',
  ]);
  const pin = source(fields.expectedSourceRevision, fields.expectedSourceSha256);
  return Object.freeze({
    expectedVersion: version(fields.expectedVersion),
    expectedDraftVersionId: diagnosticId(fields.expectedDraftVersionId),
    expectedSourceRevision: pin.revision,
    expectedSourceSha256: pin.sha,
    reviewContentSha256: diagnosticSha(fields.reviewContentSha256),
    idempotencyKey: diagnosticKey(fields.idempotencyKey),
  });
}

export function snapshotApprovalSignatureWormInspectionInput(
  value: ApprovalSignatureWormInspectionInput
): ApprovalSignatureWormInspectionInput {
  const fields = diagnosticFields(value, [
    'expectedSourceRevision',
    'expectedSourceSha256',
    'target',
    'artifactId',
    'idempotencyKey',
  ]);
  const pin = source(fields.expectedSourceRevision, fields.expectedSourceSha256);
  return Object.freeze({
    expectedSourceRevision: pin.revision,
    expectedSourceSha256: pin.sha,
    target: readApprovalSignatureProviderTarget(fields.target),
    artifactId: diagnosticNullable(fields.artifactId, diagnosticId),
    idempotencyKey: diagnosticKey(fields.idempotencyKey),
  });
}

function assertAuthority(
  authority: ApprovalSignatureProviderPinnedAuthority & Readonly<{ beforeDispatch: () => void }>
) {
  if (
    !authority.contextScopeKey.trim() ||
    !/^psr-[a-f0-9]{64}$/.test(authority.expectedDecisionRevision) ||
    !/^RS_[A-Z0-9_]{1,76}$/.test(authority.resourceSetKey) ||
    !/^[a-f0-9]{64}$/.test(authority.registrySha256) ||
    !/^[a-f0-9]{64}$/.test(authority.sourceSha256) ||
    authority.sourceRevision !== `sigp-${authority.sourceSha256}`
  )
    invalidSignatureDiagnostics();
}

function assertScope(
  value: SignatureProviderPolicyView | SignatureProviderOverview,
  authority: ApprovalSignatureProviderPinnedAuthority
) {
  const scope = value.scope;
  if (
    scope.contextScopeKey !== authority.contextScopeKey ||
    scope.decisionRevision !== authority.expectedDecisionRevision ||
    scope.resourceSetKey !== authority.resourceSetKey ||
    scope.registrySha256 !== authority.registrySha256 ||
    scope.sourceRevision !== authority.sourceRevision ||
    scope.sourceSha256 !== authority.sourceSha256
  )
    invalidSignatureDiagnostics();
}

function commandConfig(
  input: { idempotencyKey: string; expectedVersion?: number },
  execution: ApprovalMutationExecution,
  authority: ApprovalSignatureProviderPinnedAuthority & Readonly<{ beforeDispatch: () => void }>,
  highRisk: boolean,
  signal?: AbortSignal
) {
  assertAuthority(authority);
  if (
    execution.mode !== 'SECURE' ||
    execution.contextScopeKey !== authority.contextScopeKey ||
    execution.expectedDecisionRevision !== authority.expectedDecisionRevision ||
    (execution.idempotencyKey !== undefined && execution.idempotencyKey !== input.idempotencyKey) ||
    (highRisk &&
      (input.expectedVersion === undefined || execution.objectVersion !== input.expectedVersion))
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

function policyResult(
  value: unknown,
  authority: ApprovalSignatureProviderPinnedAuthority,
  policyId?: string
) {
  try {
    const parsed = readSignatureProviderPolicyView(value);
    assertScope(parsed, authority);
    if (policyId !== undefined && parsed.policyId !== policyId) invalidSignatureDiagnostics();
    return parsed;
  } catch (error) {
    throw new ApprovalSignaturePolicyResponseError(error);
  }
}

export async function initializeApprovalSignaturePolicy(
  input: ApprovalSignaturePolicyInitializeInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalSignatureProviderPinnedAuthority & Readonly<{ beforeDispatch: () => void }>,
  signal?: AbortSignal
) {
  const body = snapshotApprovalSignaturePolicyInitializeInput(input);
  const config = commandConfig(body, execution, authority, false, signal);
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${base}/policies`,
    body,
    config
  );
  config.beforeDispatch();
  return policyResult(response.data.data, authority);
}

export async function saveApprovalSignaturePolicyDraft(
  policyId: string,
  input: ApprovalSignaturePolicyDraftInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalSignatureProviderPinnedAuthority & Readonly<{ beforeDispatch: () => void }>,
  signal?: AbortSignal
) {
  diagnosticId(policyId);
  const body = snapshotApprovalSignaturePolicyDraftInput(input);
  const config = commandConfig(body, execution, authority, false, signal);
  const response = await axiosInstance.put<ApiResponse<unknown>, typeof body>(
    `${base}/policies/${policyId}/draft`,
    body,
    config
  );
  config.beforeDispatch();
  return policyResult(response.data.data, authority, policyId);
}

export async function publishApprovalSignaturePolicy(
  policyId: string,
  input: ApprovalSignaturePolicyPublishInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalSignatureProviderPinnedAuthority & Readonly<{ beforeDispatch: () => void }>,
  signal?: AbortSignal
) {
  diagnosticId(policyId);
  const body = snapshotApprovalSignaturePolicyPublishInput(input);
  const config = commandConfig(body, execution, authority, true, signal);
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${base}/policies/${policyId}/publish`,
    body,
    config
  );
  config.beforeDispatch();
  return policyResult(response.data.data, authority, policyId);
}

export async function inspectApprovalSignatureWorm(
  input: ApprovalSignatureWormInspectionInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalSignatureProviderPinnedAuthority & Readonly<{ beforeDispatch: () => void }>,
  signal?: AbortSignal
) {
  const body = snapshotApprovalSignatureWormInspectionInput(input);
  const config = commandConfig(body, execution, authority, false, signal);
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${base}/worm-inspections`,
    body,
    config
  );
  config.beforeDispatch();
  try {
    const parsed = readSignatureProviderOverview(response.data.data);
    assertScope(parsed, authority);
    return parsed;
  } catch (error) {
    throw new ApprovalSignaturePolicyResponseError(error);
  }
}
