import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import {
  assertAgentUuid,
  expectAgentData,
  isAgentDate,
  isAgentRecord,
  newAgentCommand,
} from './agent-governed-api';
import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

type AgentSchemas = AgentComponents['schemas'];

type GovernanceBoundaryKey =
  | 'automaticMemoryInference'
  | 'sensitiveMemoryAllowed'
  | 'backgroundCredentialStorage'
  | 'teamMemoryAvailable'
  | 'externalActionWithoutApproval';
const MEMORY_EVIDENCE_CAPABILITY_KEYS = [
  'manualProvenance',
  'aiDerivedMemory',
  'confidenceScoring',
  'factVector',
  'usageMetrics',
  'usageTrail',
  'kmsBinding',
] as const;
export type DwaionMemoryEvidenceCapabilityKey = (typeof MEMORY_EVIDENCE_CAPABILITY_KEYS)[number];
export type DwaionMemoryEvidenceCapability = AgentSchemas['WorkflowCapability'];
export type DwaionMemoryEvidenceCapabilities = Record<
  DwaionMemoryEvidenceCapabilityKey,
  DwaionMemoryEvidenceCapability
>;
export type DwaionPersonalAiControls = Omit<
  AgentSchemas['PersonalAiControls'],
  GovernanceBoundaryKey | 'evidenceCapabilities'
> &
  Record<GovernanceBoundaryKey, boolean | null> & {
    evidenceCapabilities: DwaionMemoryEvidenceCapabilities | null;
  };
const GOVERNANCE_BOUNDARY_KEYS: readonly GovernanceBoundaryKey[] = [
  'automaticMemoryInference',
  'sensitiveMemoryAllowed',
  'backgroundCredentialStorage',
  'teamMemoryAvailable',
  'externalActionWithoutApproval',
];
export type DwaionAiSourceKey = AgentSchemas['AiSourceKey'];
export type DwaionAiSourcePreference = AgentSchemas['AiSourcePreference'];
export type DwaionMemoryScope = 'ASK' | 'RESEARCH' | 'PROPOSALS' | 'ROUTINES' | 'ARTIFACTS';
export type DwaionPersonalMemory = Omit<AgentSchemas['PersonalMemory'], 'state'> & {
  scope: DwaionMemoryScope[];
  expiresAt: string | null;
  state: AgentSchemas['MemoryState'] | 'EXPIRED';
};
export type DwaionMemoryKind = AgentSchemas['MemoryKind'];
export type DwaionMemoryState = AgentSchemas['MemoryState'] | 'EXPIRED';
export type DwaionMemoryPreferenceState = AgentSchemas['MemoryPreferenceState'];
export type DwaionPersonalRetentionPolicy =
  AgentSchemas['dwp_agent__governed_domain_contracts__RetentionPolicy'];
export type DwaionPersonalDataProviderCapability = {
  available: boolean;
  configured: boolean;
  reasonCode: string | null;
  recoveryHint: string | null;
};
export type DwaionPersonalDataCapabilities = AgentSchemas['PersonalDataGovernanceCapabilities'] &
  Record<PersonalDataProviderCapabilityKey, DwaionPersonalDataProviderCapability>;
export type DwaionDeletionDomain = AgentSchemas['DomainKey'];
export type DwaionDeletionJob = AgentSchemas['DeletionJob'];

const CONTROL_BASE = '/api/agent/v1/ai-controls';
const PERSONAL_DATA_BASE = '/api/agent/v1/personal-data';
const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const MEMORY_SCOPES = new Set<DwaionMemoryScope>([
  'ASK',
  'RESEARCH',
  'PROPOSALS',
  'ROUTINES',
  'ARTIFACTS',
]);

export type DwaionMemoryCreateOptions = {
  scope?: readonly DwaionMemoryScope[];
  expiresAt?: string | null;
};

export type DwaionMemoryUpdate = {
  memory?: { value: string };
  scope?: readonly DwaionMemoryScope[];
  expiresAt?: string | null;
  changeReason: string;
};

export async function getDwaionPersonalAiControls(): Promise<DwaionPersonalAiControls> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(CONTROL_BASE);
  return normalizeControls(response.data.data);
}

export async function updateDwaionMemoryPreference(
  expectedRevision: number,
  memoryState: Extract<DwaionMemoryPreferenceState, 'ENABLED' | 'DISABLED'>,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalAiControls> {
  const body: AgentSchemas['UpdateMemoryPreferenceRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_PREFERENCE'),
    memoryState,
    changeReason: 'The user explicitly changed personal AI memory storage.',
  };
  const response = await axiosInstance.put<ApiResponse<unknown>, typeof body>(
    CONTROL_BASE,
    body,
    productSurfaceGovernedMutationConfig(authority)
  );
  return normalizeControls(response.data.data);
}

export async function updateDwaionMemoryRuntimePreference(
  expectedRevision: number,
  runtimeApplicationState: Extract<DwaionMemoryPreferenceState, 'ENABLED' | 'DISABLED'>,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalAiControls> {
  const body: AgentSchemas['UpdateMemoryRuntimePreferenceRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_RUNTIME'),
    runtimeApplicationState,
    changeReason: 'The user explicitly changed personal AI answer personalization.',
  };
  const response = await axiosInstance.put<ApiResponse<unknown>, typeof body>(
    `${CONTROL_BASE}/runtime`,
    body,
    productSurfaceGovernedMutationConfig(authority)
  );
  return normalizeControls(response.data.data);
}

export async function updateDwaionSourcePreference(
  sourceKey: DwaionAiSourceKey,
  expectedRevision: number,
  enabled: boolean,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionAiSourcePreference> {
  const body: AgentSchemas['UpdateAiSourcePreferenceRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_SOURCE_PREFERENCE'),
    enabled,
    changeReason: 'The user explicitly changed a personal AI source boundary.',
  };
  const response = await axiosInstance.put<ApiResponse<unknown>, typeof body>(
    `${CONTROL_BASE}/sources/${encodeURIComponent(sourceKey)}`,
    body,
    productSurfaceGovernedMutationConfig(authority)
  );
  return expectAgentData(
    response.data.data,
    isSourcePreference,
    'Personal AI source preference response is invalid.'
  );
}

export async function getDwaionPersonalMemories(): Promise<DwaionPersonalMemory[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${CONTROL_BASE}/memories`);
  return expectAgentData(
    response.data.data,
    (value): value is DwaionPersonalMemory[] => Array.isArray(value) && value.every(isMemory),
    'Personal AI memory list response is invalid.'
  );
}

export async function createDwaionPersonalMemory(
  kind: DwaionMemoryKind,
  value: string,
  options: DwaionMemoryCreateOptions = {},
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalMemory> {
  const scope = normalizeMemoryScope(options.scope ?? ['ASK']);
  validateMemoryExpiry(options.expiresAt ?? null);
  const body: AgentSchemas['CreateMemoryRequest'] & {
    scope: DwaionMemoryScope[];
    expiresAt: string | null;
  } = {
    ...newAgentCommand(0, 'USER_MEMORY_CREATE'),
    kind,
    memory: { value },
    scope,
    expiresAt: options.expiresAt ?? null,
  };
  return mutateMemory(`${CONTROL_BASE}/memories`, body, 'post', authority);
}

export async function updateDwaionPersonalMemory(
  memoryId: string,
  expectedRevision: number,
  patch: DwaionMemoryUpdate,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalMemory> {
  const hasExpiry = Object.prototype.hasOwnProperty.call(patch, 'expiresAt');
  if (!patch.memory && patch.scope === undefined && !hasExpiry) {
    throw new TypeError('At least one personal memory field must be updated.');
  }
  if (patch.memory && !patch.memory.value.trim()) {
    throw new TypeError('Personal memory value is required.');
  }
  const scope = patch.scope === undefined ? undefined : normalizeMemoryScope(patch.scope);
  if (hasExpiry) validateMemoryExpiry(patch.expiresAt ?? null);
  if (patch.changeReason.trim().length < 5) {
    throw new TypeError('Personal memory change reason is required.');
  }
  const body: Omit<AgentSchemas['UpdateMemoryRequest'], 'memory'> & {
    memory?: { value: string };
    scope?: DwaionMemoryScope[];
    expiresAt?: string | null;
    changeReason: string;
  } = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_UPDATE'),
    ...(patch.memory ? { memory: patch.memory } : {}),
    ...(scope ? { scope } : {}),
    ...(hasExpiry ? { expiresAt: patch.expiresAt ?? null } : {}),
    changeReason: patch.changeReason.trim(),
  };
  return mutateMemory(
    `${CONTROL_BASE}/memories/${encodeMemoryId(memoryId)}`,
    body,
    'put',
    authority
  );
}

export async function changeDwaionPersonalMemoryState(
  memoryId: string,
  expectedRevision: number,
  memoryState: Extract<DwaionMemoryState, 'ACTIVE' | 'DISABLED'>,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalMemory> {
  const body: AgentSchemas['ChangeMemoryStateRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_STATE'),
    memoryState,
    changeReason: 'The user explicitly changed a personal AI memory state.',
  };
  return mutateMemory(
    `${CONTROL_BASE}/memories/${encodeMemoryId(memoryId)}/state`,
    body,
    'post',
    authority
  );
}

export async function deleteDwaionPersonalMemory(
  memoryId: string,
  expectedRevision: number,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalMemory> {
  const body: AgentSchemas['DeleteMemoryRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_DELETE'),
    changeReason: 'The user explicitly deleted this personal AI memory.',
  };
  return mutateMemory(
    `${CONTROL_BASE}/memories/${encodeMemoryId(memoryId)}/delete`,
    body,
    'post',
    authority
  );
}

export async function getDwaionRetentionPolicies(): Promise<DwaionPersonalRetentionPolicy[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${PERSONAL_DATA_BASE}/retention`);
  return expectAgentData(
    response.data.data,
    (value): value is DwaionPersonalRetentionPolicy[] =>
      Array.isArray(value) && value.every(isRetentionPolicy),
    'Personal data retention response is invalid.'
  );
}

export async function getDwaionPersonalDataCapabilities(): Promise<DwaionPersonalDataCapabilities> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PERSONAL_DATA_BASE}/capabilities`
  );
  return expectAgentData(
    response.data.data,
    isPersonalDataCapabilities,
    'Personal data capability response is invalid.'
  );
}

export async function requestDwaionPersonalDataDeletion(
  domains: DwaionDeletionDomain[],
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY,
  commandId: string = globalThis.crypto.randomUUID()
): Promise<DwaionDeletionJob> {
  assertAgentUuid(commandId, 'Personal data deletion command identifier');
  const body: AgentSchemas['RequestDeletionRequest'] = {
    commandId,
    expectedRevision: 0,
    reasonCode: 'USER_DATA_DELETION',
    domains,
    changeReason: 'The user explicitly requested deletion of personal AI data.',
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${PERSONAL_DATA_BASE}/deletions`,
    body,
    productSurfaceGovernedMutationConfig(authority)
  );
  return expectAgentData(
    response.data.data,
    isDeletionJob,
    'Personal data deletion response is invalid.'
  );
}

export async function getDwaionPersonalDataDeletion(
  deletionJobId: string
): Promise<DwaionDeletionJob> {
  assertAgentUuid(deletionJobId, 'Personal data deletion job identifier');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PERSONAL_DATA_BASE}/deletions/${encodeURIComponent(deletionJobId)}`
  );
  return expectAgentData(
    response.data.data,
    isDeletionJob,
    'Personal data deletion response is invalid.'
  );
}

export async function getDwaionPersonalDataDeletions(
  signal?: AbortSignal
): Promise<DwaionDeletionJob[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PERSONAL_DATA_BASE}/deletions`,
    { signal }
  );
  return expectAgentData(
    response.data.data,
    (value): value is DwaionDeletionJob[] => Array.isArray(value) && value.every(isDeletionJob),
    'Personal data deletion history response is invalid.'
  );
}

export async function retryDwaionPersonalDataDeletion(
  deletionJobId: string,
  expectedAttemptCount: number,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionDeletionJob> {
  assertAgentUuid(deletionJobId, 'Personal data deletion job identifier');
  assertAgentUuid(commandId, 'Personal data deletion retry command identifier');
  if (!Number.isInteger(expectedAttemptCount) || expectedAttemptCount < 0)
    throw new TypeError('Personal data deletion retry attempt is invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${PERSONAL_DATA_BASE}/deletions/${encodeURIComponent(deletionJobId)}/retry`,
    {
      commandId,
      expectedRevision: expectedAttemptCount,
      reasonCode: 'USER_DATA_DELETION_RETRY',
      changeReason: 'The user reviewed the partial or failed targets and requested a retry.',
    },
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  const job = expectAgentData(
    response.data.data,
    isDeletionJob,
    'Personal data deletion retry response is invalid.'
  );
  if (job.deletionJobId !== deletionJobId)
    throw new TypeError('Personal data deletion retry response binding is invalid.');
  return job;
}

async function mutateMemory(
  url: string,
  body: object,
  method: 'post' | 'put',
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalMemory> {
  const config = productSurfaceGovernedMutationConfig(authority);
  const response =
    method === 'post'
      ? await axiosInstance.post<ApiResponse<unknown>, object>(url, body, config)
      : await axiosInstance.put<ApiResponse<unknown>, object>(url, body, config);
  return expectAgentData(response.data.data, isMemory, 'Personal AI memory response is invalid.');
}

function encodeMemoryId(memoryId: string): string {
  assertAgentUuid(memoryId, 'Personal AI memory identifier');
  return encodeURIComponent(memoryId);
}

function normalizeMemoryScope(scope: readonly DwaionMemoryScope[]): DwaionMemoryScope[] {
  if (
    scope.length === 0 ||
    new Set(scope).size !== scope.length ||
    !scope.every((item) => MEMORY_SCOPES.has(item))
  ) {
    throw new TypeError('Personal memory scope must contain unique supported values.');
  }
  return [...scope];
}

function validateMemoryExpiry(expiresAt: string | null) {
  if (expiresAt === null) return;
  if (!isAgentDate(expiresAt) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(expiresAt)) {
    throw new TypeError('Personal memory expiry must be a timezone-aware timestamp.');
  }
}

function normalizeControls(value: unknown): DwaionPersonalAiControls {
  const controls = expectAgentData(
    value,
    isControlsRecord,
    'Personal AI controls response is invalid.'
  );
  const runtimeState = controls.runtimeApplicationState;
  const hasRuntimeContract =
    ['UNSET', 'DISABLED', 'ENABLED'].includes(String(runtimeState)) &&
    typeof controls.runtimeApplicationEnabled === 'boolean' &&
    typeof controls.runtimeApplicationAvailable === 'boolean';
  return {
    ...controls,
    ...Object.fromEntries(
      GOVERNANCE_BOUNDARY_KEYS.map((key) => [
        key,
        typeof controls[key] === 'boolean' ? controls[key] : null,
      ])
    ),
    memoryEffective: hasRuntimeContract ? controls.memoryEffective : false,
    runtimeApplicationState: hasRuntimeContract
      ? (runtimeState as DwaionMemoryPreferenceState)
      : 'UNSET',
    runtimeApplicationEnabled: hasRuntimeContract ? controls.runtimeApplicationEnabled : false,
    runtimeApplicationAvailable: hasRuntimeContract ? controls.runtimeApplicationAvailable : false,
    evidenceCapabilities: normalizeMemoryEvidenceCapabilities(controls.evidenceCapabilities),
  } as DwaionPersonalAiControls;
}

function isControlsRecord(value: unknown): value is Record<string, unknown> {
  return (
    isAgentRecord(value) &&
    ['UNSET', 'DISABLED', 'ENABLED'].includes(String(value.memoryState)) &&
    Number.isInteger(value.revision) &&
    typeof value.memoryEnabled === 'boolean' &&
    typeof value.memoryEffective === 'boolean' &&
    Array.isArray(value.sourcePreferences) &&
    value.sourcePreferences.every(isSourcePreference) &&
    GOVERNANCE_BOUNDARY_KEYS.every((key) => value[key] == null || typeof value[key] === 'boolean')
  );
}

function isSourcePreference(value: unknown): value is DwaionAiSourcePreference {
  return (
    isAgentRecord(value) &&
    typeof value.sourceKey === 'string' &&
    typeof value.available === 'boolean' &&
    typeof value.enabled === 'boolean' &&
    typeof value.effective === 'boolean' &&
    Number.isInteger(value.revision)
  );
}

function isMemory(value: unknown): value is DwaionPersonalMemory {
  return (
    isAgentRecord(value) &&
    typeof value.memoryId === 'string' &&
    typeof value.kind === 'string' &&
    value.origin === 'MANUAL' &&
    value.sourceType === 'USER_EXPLICIT_ENTRY' &&
    Number.isInteger(value.useCount) &&
    Number(value.useCount) >= 0 &&
    (value.lastUsedAt === null ||
      value.lastUsedAt === undefined ||
      isAgentDate(value.lastUsedAt)) &&
    (value.confidence === null ||
      value.confidence === undefined ||
      (typeof value.confidence === 'number' &&
        Number.isFinite(value.confidence) &&
        value.confidence >= 0 &&
        value.confidence <= 1)) &&
    (value.factVector === undefined ||
      (Array.isArray(value.factVector) &&
        value.factVector.every((item) => typeof item === 'string' && item.trim().length > 0))) &&
    (value.encryptionProvider === null ||
      value.encryptionProvider === undefined ||
      (typeof value.encryptionProvider === 'string' &&
        value.encryptionProvider.trim().length > 0)) &&
    (value.encryptionKeyVersion === null ||
      value.encryptionKeyVersion === undefined ||
      (typeof value.encryptionKeyVersion === 'string' &&
        value.encryptionKeyVersion.trim().length > 0)) &&
    (value.encryptionKeyReferenceFingerprint === null ||
      value.encryptionKeyReferenceFingerprint === undefined ||
      (typeof value.encryptionKeyReferenceFingerprint === 'string' &&
        value.encryptionKeyReferenceFingerprint.trim().length > 0)) &&
    ['ACTIVE', 'DISABLED', 'DELETED', 'EXPIRED'].includes(String(value.state)) &&
    Number.isInteger(value.revision) &&
    isAgentRecord(value.memory) &&
    typeof value.memory.value === 'string' &&
    Array.isArray(value.scope) &&
    value.scope.length > 0 &&
    new Set(value.scope).size === value.scope.length &&
    value.scope.every((scope) => MEMORY_SCOPES.has(scope as DwaionMemoryScope)) &&
    (value.expiresAt === null || isAgentDate(value.expiresAt)) &&
    isAgentDate(value.createdAt) &&
    isAgentDate(value.updatedAt)
  );
}

function normalizeMemoryEvidenceCapabilities(
  value: unknown
): DwaionMemoryEvidenceCapabilities | null {
  if (
    !isAgentRecord(value) ||
    !MEMORY_EVIDENCE_CAPABILITY_KEYS.every((key) => isWorkflowCapability(value[key]))
  ) {
    return null;
  }
  return Object.fromEntries(
    MEMORY_EVIDENCE_CAPABILITY_KEYS.map((key) => [key, value[key]])
  ) as DwaionMemoryEvidenceCapabilities;
}

function isWorkflowCapability(value: unknown): value is DwaionMemoryEvidenceCapability {
  return (
    isAgentRecord(value) &&
    typeof value.available === 'boolean' &&
    typeof value.configured === 'boolean' &&
    (!value.available || value.configured) &&
    (value.reasonCode === null ||
      value.reasonCode === undefined ||
      (typeof value.reasonCode === 'string' && SAFE_ERROR_CODE.test(value.reasonCode))) &&
    (value.recoveryHint === null ||
      value.recoveryHint === undefined ||
      (typeof value.recoveryHint === 'string' && value.recoveryHint.trim().length > 0))
  );
}

function isRetentionPolicy(value: unknown): value is DwaionPersonalRetentionPolicy {
  return (
    isAgentRecord(value) &&
    typeof value.domain === 'string' &&
    Number.isInteger(value.retentionDays) &&
    Number.isInteger(value.deletionGraceDays) &&
    typeof value.legalHold === 'boolean' &&
    Number.isInteger(value.revision) &&
    isAgentDate(value.updatedAt)
  );
}

function isPersonalDataCapabilities(value: unknown): value is DwaionPersonalDataCapabilities {
  return (
    isAgentRecord(value) &&
    Array.isArray(value.supportedDeletionDomains) &&
    typeof value.deletionRequestAvailable === 'boolean' &&
    typeof value.deletionExecutionAvailable === 'boolean' &&
    typeof value.deletionCompletionClaimAvailable === 'boolean' &&
    PERSONAL_DATA_PROVIDER_CAPABILITY_KEYS.every((key) =>
      isPersonalDataProviderCapability(value[key])
    ) &&
    PERSONAL_DATA_UNBOUND_CAPABILITY_KEYS.every(
      (key) => isAgentRecord(value[key]) && value[key].available === false
    )
  );
}

function isPersonalDataProviderCapability(value: unknown) {
  return (
    isAgentRecord(value) &&
    typeof value.available === 'boolean' &&
    typeof value.configured === 'boolean' &&
    (value.reasonCode === null ||
      (typeof value.reasonCode === 'string' && SAFE_ERROR_CODE.test(value.reasonCode))) &&
    (value.recoveryHint === null ||
      (typeof value.recoveryHint === 'string' && value.recoveryHint.trim().length > 0)) &&
    (!value.available || value.configured)
  );
}

function isDeletionJob(value: unknown): value is DwaionDeletionJob {
  if (!isAgentRecord(value)) return false;
  const { blockedDomains, deletionJobId, domains, state, targets } = value;
  if (
    typeof deletionJobId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      deletionJobId
    ) ||
    typeof state !== 'string' ||
    !DELETION_JOB_STATES.has(state) ||
    !domainList(domains) ||
    domains.length < 1 ||
    !isAgentDate(value.requestedAt) ||
    !(value.completedAt === null || isAgentDate(value.completedAt)) ||
    typeof value.deletionPerformed !== 'boolean' ||
    typeof value.deletionExecutionAvailable !== 'boolean' ||
    !domainList(blockedDomains) ||
    !blockedDomains.every((domain) => domains.includes(domain)) ||
    !Number.isInteger(value.attemptCount) ||
    Number(value.attemptCount) < 0 ||
    !Array.isArray(targets) ||
    targets.length > 4 ||
    !targets.every(isDeletionTarget) ||
    new Set(targets.map((target) => target.domain)).size !== targets.length
  )
    return false;
  const terminal = ['PARTIAL', 'COMPLETED', 'BLOCKED_LEGAL_HOLD', 'FAILED'].includes(state);
  return (
    terminal === (value.completedAt !== null) &&
    (state === 'COMPLETED') === value.deletionPerformed &&
    targets.every((target) => domains.includes(target.domain))
  );
}

function isDeletionTarget(value: unknown): boolean {
  if (!isAgentRecord(value)) return false;
  const disposition = value.disposition;
  return (
    DELETION_DOMAINS.has(String(value.domain)) &&
    DELETION_TARGET_STATES.has(String(value.state)) &&
    (value.affectedCount === null ||
      (Number.isInteger(value.affectedCount) && Number(value.affectedCount) >= 0)) &&
    (value.safeErrorCode === null ||
      (typeof value.safeErrorCode === 'string' && SAFE_ERROR_CODE.test(value.safeErrorCode))) &&
    (disposition === null || isDisposition(disposition)) &&
    (value.state === 'COMPLETED') === (disposition !== null) &&
    (disposition === null || disposition.domain === value.domain)
  );
}

function isDisposition(value: unknown): value is Record<string, unknown> {
  if (
    !isAgentRecord(value) ||
    typeof value.dispositionId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value.dispositionId
    ) ||
    !DELETION_DOMAINS.has(String(value.domain)) ||
    !Number.isInteger(value.generation) ||
    Number(value.generation) < 1 ||
    !Number.isInteger(value.purgedRowCount) ||
    Number(value.purgedRowCount) < 0 ||
    !isAgentRecord(value.purgedTableCounts) ||
    Object.entries(value.purgedTableCounts).some(
      ([table, count]) => !table.startsWith('ai_') || !Number.isInteger(count) || Number(count) < 0
    ) ||
    value.dispositionScope !== 'AGENT_ACTIVE_POSTGRES_DOMAIN_ONLY' ||
    value.dispositionMethod !== 'PHYSICAL_ROW_PURGE_OF_ENCRYPTED_RECORDS' ||
    value.activeStoreEnvelopesDestroyed !== true ||
    value.sourceSystemDataAffected !== false ||
    value.backupDispositionState !== 'EXTERNAL_RETENTION_BOUNDARY' ||
    typeof value.receiptFingerprint !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(value.receiptFingerprint) ||
    !isAgentDate(value.completedAt)
  )
    return false;
  return (
    Object.values(value.purgedTableCounts).reduce<number>(
      (sum, count) => sum + Number(count),
      0
    ) === value.purgedRowCount
  );
}

function domainList(value: unknown): value is DwaionDeletionDomain[] {
  return (
    Array.isArray(value) &&
    value.length <= 4 &&
    new Set(value).size === value.length &&
    value.every((domain) => typeof domain === 'string' && DELETION_DOMAINS.has(domain))
  );
}

const DELETION_DOMAINS = new Set(['ROUTINE', 'MEMORY', 'ARTIFACT', 'ARTIFACT_EXPORT']);
const DELETION_JOB_STATES = new Set([
  'REQUESTED',
  'RUNNING',
  'PARTIAL',
  'COMPLETED',
  'BLOCKED_LEGAL_HOLD',
  'FAILED',
]);
const DELETION_TARGET_STATES = new Set([
  'REQUESTED',
  'RUNNING',
  'COMPLETED',
  'BLOCKED_LEGAL_HOLD',
  'FAILED',
]);
const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_.-]{1,127}$/u;
const PERSONAL_DATA_PROVIDER_CAPABILITY_KEYS = [
  'backupDestructionLog',
  'sreSupport',
  'legalHoldEvidence',
  'legalHoldAppeal',
  'signedCertificate',
  'siemSync',
] as const;
const PERSONAL_DATA_UNBOUND_CAPABILITY_KEYS = [
  'backupDestructionLog',
  'sreSupport',
  'legalHoldAppeal',
  'signedCertificate',
  'siemSync',
] as const;
type PersonalDataProviderCapabilityKey = (typeof PERSONAL_DATA_PROVIDER_CAPABILITY_KEYS)[number];
