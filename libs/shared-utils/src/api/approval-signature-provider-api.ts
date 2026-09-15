import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  approvalMutationExecutionConfig,
  type ApprovalMutationExecution,
} from './approval-governed-mutation';
import {
  readSignatureProviderCheck,
  readSignatureProviderDiagnosticHistory,
  readSignatureProviderDiagnostics,
  readSignatureProviderOverview,
  readSignatureProviderPin,
  readSignatureProviderScope,
  type SignatureProviderDiagnosticHistory,
  type SignatureProviderDiagnostics,
  type SignatureProviderOverview,
  type SignatureProviderPin,
  type SignatureProviderScope,
} from './approval-signature-diagnostics-contract';
import {
  diagnosticBoolean,
  diagnosticEnum,
  diagnosticFields,
  diagnosticId,
  diagnosticInstant,
  diagnosticList,
  diagnosticNullable,
  diagnosticReasons,
  diagnosticSha,
  diagnosticUnique,
  invalidSignatureDiagnostics,
  SIGNATURE_PROBE_OUTCOMES,
  SIGNATURE_PROBE_STATES,
} from './approval-signature-diagnostics-primitives';
import {
  readSignatureProviderPolicyHistory,
  readSignatureProviderPolicyView,
  type SignatureProviderPolicyHistory,
  type SignatureProviderPolicyView,
} from './approval-signature-provider-policy-contract';

const base = '/api/approvals/v1/admin/signatures';

export type ApprovalSignatureProviderReadAuthority = Readonly<{
  contextScopeKey: string;
  expectedDecisionRevision: string;
  beforeDispatch?: () => void;
}>;

export type ApprovalSignatureProviderPinnedAuthority = ApprovalSignatureProviderReadAuthority &
  Readonly<{
    resourceSetKey: string;
    registrySha256: string;
    sourceRevision: string;
    sourceSha256: string;
  }>;

export type ApprovalSignatureProviderTarget = Readonly<{
  providerId: string;
  expectedProviderVersion: number;
  expectedProviderSha256: string;
  expectedConfiguration: SignatureProviderPin | null;
}>;

export type ApprovalSignatureProviderProbeInput = Readonly<{
  expectedSourceRevision: string;
  expectedSourceSha256: string;
  allProviders: boolean;
  targets: readonly ApprovalSignatureProviderTarget[];
  idempotencyKey: string;
}>;

export type ApprovalSignatureProviderKmsProbeInput = Readonly<{
  expectedSourceRevision: string;
  expectedSourceSha256: string;
  target: ApprovalSignatureProviderTarget;
  idempotencyKey: string;
}>;

export type ApprovalSignatureProviderProbeRun = Readonly<{
  scope: SignatureProviderScope;
  probeRunId: string;
  state: (typeof SIGNATURE_PROBE_STATES)[number];
  startedAt: string;
  completedAt: string | null;
  originalBodySha256: string;
  originalTargets: readonly ApprovalSignatureProviderTarget[];
  providerResults: readonly Readonly<{
    providerId: string;
    originalTarget: ApprovalSignatureProviderTarget;
    outcome: (typeof SIGNATURE_PROBE_OUTCOMES)[number];
    observedAt: string | null;
    cooldownUntil: string | null;
    reasonCodes: readonly string[];
    checks: readonly ReturnType<typeof readSignatureProviderCheck>[];
  }>[];
}>;

function validDecisionRevision(value: string): boolean {
  return /^psr-[a-f0-9]{64}$/.test(value);
}

function validResourceSet(value: string): boolean {
  return /^RS_[A-Z0-9_]{1,76}$/.test(value);
}

function assertReadAuthority(authority: ApprovalSignatureProviderReadAuthority): void {
  if (
    !authority.contextScopeKey.trim() ||
    authority.contextScopeKey.length > 512 ||
    !validDecisionRevision(authority.expectedDecisionRevision)
  ) {
    invalidSignatureDiagnostics();
  }
}

function assertPinnedAuthority(authority: ApprovalSignatureProviderPinnedAuthority): void {
  assertReadAuthority(authority);
  if (
    !validResourceSet(authority.resourceSetKey) ||
    !/^[a-f0-9]{64}$/.test(authority.registrySha256) ||
    authority.sourceRevision !== `sigp-${authority.sourceSha256}` ||
    !/^[a-f0-9]{64}$/.test(authority.sourceSha256)
  ) {
    invalidSignatureDiagnostics();
  }
}

function assertScope(
  scope: SignatureProviderScope,
  authority: ApprovalSignatureProviderReadAuthority | ApprovalSignatureProviderPinnedAuthority
): void {
  if (
    scope.contextScopeKey !== authority.contextScopeKey ||
    scope.decisionRevision !== authority.expectedDecisionRevision
  ) {
    invalidSignatureDiagnostics();
  }
  if (
    'sourceRevision' in authority &&
    (scope.resourceSetKey !== authority.resourceSetKey ||
      scope.registrySha256 !== authority.registrySha256 ||
      scope.sourceRevision !== authority.sourceRevision ||
      scope.sourceSha256 !== authority.sourceSha256)
  ) {
    invalidSignatureDiagnostics();
  }
}

function readOptions(authority: ApprovalSignatureProviderReadAuthority, signal?: AbortSignal) {
  assertReadAuthority(authority);
  return {
    contextScopeKey: authority.contextScopeKey,
    headers: { 'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision },
    ...(signal ? { signal } : {}),
    ...(authority.beforeDispatch ? { beforeDispatch: authority.beforeDispatch } : {}),
    timeoutMs: 10_000,
  };
}

async function read<T>(
  path: string,
  authority: ApprovalSignatureProviderReadAuthority | ApprovalSignatureProviderPinnedAuthority,
  parse: (value: unknown) => T,
  scope: (value: T) => SignatureProviderScope,
  signal?: AbortSignal
): Promise<T> {
  if ('sourceRevision' in authority) assertPinnedAuthority(authority);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    path,
    readOptions(authority, signal)
  );
  authority.beforeDispatch?.();
  const value = parse(response.data.data);
  assertScope(scope(value), authority);
  return value;
}

export function getApprovalSignatureProviderOverview(
  authority: ApprovalSignatureProviderReadAuthority,
  signal?: AbortSignal
): Promise<SignatureProviderOverview> {
  return read(
    `${base}/diagnostics`,
    authority,
    readSignatureProviderOverview,
    (value) => value.scope,
    signal
  );
}

export function getApprovalSignatureProviderDiagnostics(
  providerId: string,
  authority: ApprovalSignatureProviderPinnedAuthority,
  signal?: AbortSignal
): Promise<SignatureProviderDiagnostics> {
  diagnosticId(providerId);
  return read(
    `${base}/providers/${providerId}/diagnostics`,
    authority,
    (value) => {
      const parsed = readSignatureProviderDiagnostics(value);
      if (parsed.provider.providerId !== providerId) invalidSignatureDiagnostics();
      return parsed;
    },
    (value) => value.scope,
    signal
  );
}

export function getApprovalSignatureProviderDiagnosticHistory(
  cursor: string | null,
  authority: ApprovalSignatureProviderPinnedAuthority,
  signal?: AbortSignal
): Promise<SignatureProviderDiagnosticHistory> {
  if (cursor !== null && !/^\d{1,19}$/.test(cursor)) invalidSignatureDiagnostics();
  return read(
    `${base}/diagnostic-history${cursor === null ? '' : `?cursor=${cursor}`}`,
    authority,
    readSignatureProviderDiagnosticHistory,
    (value) => value.scope,
    signal
  );
}

export function getApprovalSignatureProviderPolicy(
  authority: ApprovalSignatureProviderPinnedAuthority,
  signal?: AbortSignal
): Promise<SignatureProviderPolicyView> {
  return read(
    `${base}/policy`,
    authority,
    readSignatureProviderPolicyView,
    (value) => value.scope,
    signal
  );
}

export function getApprovalSignatureProviderPolicyHistory(
  policyId: string,
  cursor: string | null,
  authority: ApprovalSignatureProviderPinnedAuthority,
  signal?: AbortSignal
): Promise<SignatureProviderPolicyHistory> {
  diagnosticId(policyId);
  if (cursor !== null && !/^\d{1,19}$/.test(cursor)) invalidSignatureDiagnostics();
  return read(
    `${base}/policies/${policyId}/history${cursor === null ? '' : `?cursor=${cursor}`}`,
    authority,
    readSignatureProviderPolicyHistory,
    (value) => value.scope,
    signal
  );
}

export function readApprovalSignatureProviderTarget(
  value: unknown
): ApprovalSignatureProviderTarget {
  const fields = diagnosticFields(value, [
    'providerId',
    'expectedProviderVersion',
    'expectedProviderSha256',
    'expectedConfiguration',
  ]);
  const version = fields.expectedProviderVersion;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0)
    invalidSignatureDiagnostics();
  return Object.freeze({
    providerId: diagnosticId(fields.providerId),
    expectedProviderVersion: version,
    expectedProviderSha256: diagnosticSha(fields.expectedProviderSha256),
    expectedConfiguration: diagnosticNullable(
      fields.expectedConfiguration,
      readSignatureProviderPin
    ),
  });
}

export function snapshotApprovalSignatureProviderTarget(
  details: SignatureProviderDiagnostics
): ApprovalSignatureProviderTarget {
  const provider = details.provider;
  if (
    provider.providerId === null ||
    provider.providerVersion === null ||
    provider.providerSha256 === null
  ) {
    invalidSignatureDiagnostics();
  }
  return readApprovalSignatureProviderTarget({
    providerId: provider.providerId,
    expectedProviderVersion: provider.providerVersion,
    expectedProviderSha256: provider.providerSha256,
    expectedConfiguration: details.settings.configuration,
  });
}

export function snapshotApprovalSignatureProviderProbeInput(
  input: ApprovalSignatureProviderProbeInput
): ApprovalSignatureProviderProbeInput {
  const fields = diagnosticFields(input, [
    'expectedSourceRevision',
    'expectedSourceSha256',
    'allProviders',
    'targets',
    'idempotencyKey',
  ]);
  const sourceSha256 = diagnosticSha(fields.expectedSourceSha256);
  if (fields.expectedSourceRevision !== `sigp-${sourceSha256}`) invalidSignatureDiagnostics();
  const targets = diagnosticUnique(
    diagnosticList(fields.targets, readApprovalSignatureProviderTarget, 10),
    (target) => target.providerId
  );
  const allProviders = diagnosticBoolean(fields.allProviders);
  if (
    targets.length === 0 ||
    (!allProviders && targets.length !== 1) ||
    typeof fields.idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,120}$/.test(fields.idempotencyKey)
  ) {
    invalidSignatureDiagnostics();
  }
  return Object.freeze({
    expectedSourceRevision: fields.expectedSourceRevision as string,
    expectedSourceSha256: sourceSha256,
    allProviders,
    targets,
    idempotencyKey: fields.idempotencyKey,
  });
}

export function snapshotApprovalSignatureProviderKmsProbeInput(
  input: ApprovalSignatureProviderKmsProbeInput
): ApprovalSignatureProviderKmsProbeInput {
  const fields = diagnosticFields(input, [
    'expectedSourceRevision',
    'expectedSourceSha256',
    'target',
    'idempotencyKey',
  ]);
  const sourceSha256 = diagnosticSha(fields.expectedSourceSha256);
  if (
    fields.expectedSourceRevision !== `sigp-${sourceSha256}` ||
    typeof fields.idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,120}$/.test(fields.idempotencyKey)
  ) {
    invalidSignatureDiagnostics();
  }
  return Object.freeze({
    expectedSourceRevision: fields.expectedSourceRevision as string,
    expectedSourceSha256: sourceSha256,
    target: readApprovalSignatureProviderTarget(fields.target),
    idempotencyKey: fields.idempotencyKey,
  });
}

function readProbeRun(value: unknown): ApprovalSignatureProviderProbeRun {
  const fields = diagnosticFields(value, [
    'scope',
    'probeRunId',
    'state',
    'startedAt',
    'completedAt',
    'originalBodySha256',
    'originalTargets',
    'providerResults',
  ]);
  const originalTargets = diagnosticUnique(
    diagnosticList(fields.originalTargets, readApprovalSignatureProviderTarget, 10),
    (target) => target.providerId
  );
  const providerResults = diagnosticUnique(
    diagnosticList(
      fields.providerResults,
      (entry) => {
        const result = diagnosticFields(entry, [
          'providerId',
          'originalTarget',
          'outcome',
          'observedAt',
          'cooldownUntil',
          'reasonCodes',
          'checks',
        ]);
        const originalTarget = readApprovalSignatureProviderTarget(result.originalTarget);
        const providerId = diagnosticId(result.providerId);
        if (providerId !== originalTarget.providerId) invalidSignatureDiagnostics();
        return Object.freeze({
          providerId,
          originalTarget,
          outcome: diagnosticEnum(result.outcome, SIGNATURE_PROBE_OUTCOMES),
          observedAt: diagnosticNullable(result.observedAt, diagnosticInstant),
          cooldownUntil: diagnosticNullable(result.cooldownUntil, diagnosticInstant),
          reasonCodes: diagnosticReasons(result.reasonCodes),
          checks: diagnosticList(result.checks, readSignatureProviderCheck, 32),
        });
      },
      10
    ),
    (result) => result.providerId
  );
  const state = diagnosticEnum(fields.state, SIGNATURE_PROBE_STATES);
  const startedAt = diagnosticInstant(fields.startedAt);
  const completedAt = diagnosticNullable(fields.completedAt, diagnosticInstant);
  if (
    (completedAt !== null && Date.parse(completedAt) < Date.parse(startedAt)) ||
    (['COMPLETE', 'PARTIAL'].includes(state) &&
      (completedAt === null || providerResults.length !== originalTargets.length)) ||
    providerResults.some(
      (result) =>
        !originalTargets.some(
          (target) => JSON.stringify(target) === JSON.stringify(result.originalTarget)
        )
    )
  ) {
    invalidSignatureDiagnostics();
  }
  return Object.freeze({
    scope: readSignatureProviderScope(fields.scope),
    probeRunId: diagnosticId(fields.probeRunId),
    state,
    startedAt,
    completedAt,
    originalBodySha256: diagnosticSha(fields.originalBodySha256),
    originalTargets,
    providerResults,
  });
}

export async function probeApprovalSignatureProviders(
  input: ApprovalSignatureProviderProbeInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalSignatureProviderPinnedAuthority & Readonly<{ beforeDispatch: () => void }>,
  signal?: AbortSignal
): Promise<ApprovalSignatureProviderProbeRun> {
  const body = snapshotApprovalSignatureProviderProbeInput(input);
  assertPinnedAuthority(authority);
  if (
    execution.mode !== 'SECURE' ||
    execution.contextScopeKey !== authority.contextScopeKey ||
    execution.expectedDecisionRevision !== authority.expectedDecisionRevision ||
    (execution.idempotencyKey !== undefined && execution.idempotencyKey !== body.idempotencyKey)
  ) {
    invalidSignatureDiagnostics();
  }
  const secured = Object.freeze({ ...execution, idempotencyKey: body.idempotencyKey });
  const config = approvalMutationExecutionConfig(secured);
  const beforeDispatch = () => {
    if (signal?.aborted) invalidSignatureDiagnostics();
    authority.beforeDispatch();
  };
  beforeDispatch();
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    ApprovalSignatureProviderProbeInput
  >(`${base}/probes`, body, {
    ...config,
    headers: {
      ...config.headers,
      'Idempotency-Key': body.idempotencyKey,
      'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision,
    },
    contextScopeKey: authority.contextScopeKey,
    beforeDispatch,
    csrfReplay: 'NEVER',
    ...(signal ? { signal } : {}),
    timeoutMs: 20_000,
  });
  beforeDispatch();
  const run = readProbeRun(response.data.data);
  assertScope(run.scope, authority);
  if (
    run.originalTargets.length !== body.targets.length ||
    run.originalTargets.some(
      (target, index) => JSON.stringify(target) !== JSON.stringify(body.targets[index])
    )
  ) {
    invalidSignatureDiagnostics();
  }
  return run;
}

export async function probeApprovalSignatureProviderKms(
  input: ApprovalSignatureProviderKmsProbeInput,
  execution: ApprovalMutationExecution,
  authority: ApprovalSignatureProviderPinnedAuthority & Readonly<{ beforeDispatch: () => void }>,
  signal?: AbortSignal
): Promise<SignatureProviderOverview> {
  const body = snapshotApprovalSignatureProviderKmsProbeInput(input);
  assertPinnedAuthority(authority);
  if (
    execution.mode !== 'SECURE' ||
    execution.contextScopeKey !== authority.contextScopeKey ||
    execution.expectedDecisionRevision !== authority.expectedDecisionRevision ||
    (execution.idempotencyKey !== undefined && execution.idempotencyKey !== body.idempotencyKey)
  ) {
    invalidSignatureDiagnostics();
  }
  const secured = Object.freeze({ ...execution, idempotencyKey: body.idempotencyKey });
  const config = approvalMutationExecutionConfig(secured);
  const beforeDispatch = () => {
    if (signal?.aborted) invalidSignatureDiagnostics();
    authority.beforeDispatch();
  };
  beforeDispatch();
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    ApprovalSignatureProviderKmsProbeInput
  >(`${base}/kms/probes`, body, {
    ...config,
    headers: {
      ...config.headers,
      'Idempotency-Key': body.idempotencyKey,
      'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision,
    },
    contextScopeKey: authority.contextScopeKey,
    beforeDispatch,
    csrfReplay: 'NEVER',
    ...(signal ? { signal } : {}),
    timeoutMs: 20_000,
  });
  beforeDispatch();
  const overview = readSignatureProviderOverview(response.data.data);
  if (
    overview.scope.contextScopeKey !== authority.contextScopeKey ||
    overview.scope.decisionRevision !== authority.expectedDecisionRevision ||
    overview.scope.resourceSetKey !== authority.resourceSetKey ||
    overview.scope.registrySha256 !== authority.registrySha256
  ) {
    invalidSignatureDiagnostics();
  }
  return overview;
}
