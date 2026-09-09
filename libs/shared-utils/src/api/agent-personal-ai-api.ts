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
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

type AgentSchemas = AgentComponents['schemas'];

type GovernanceBoundaryKey =
  | 'automaticMemoryInference'
  | 'sensitiveMemoryAllowed'
  | 'backgroundCredentialStorage'
  | 'teamMemoryAvailable'
  | 'externalActionWithoutApproval';
export type DwaionPersonalAiControls = Omit<
  AgentSchemas['PersonalAiControls'],
  GovernanceBoundaryKey
> &
  Record<GovernanceBoundaryKey, boolean | null>;
const GOVERNANCE_BOUNDARY_KEYS: readonly GovernanceBoundaryKey[] = [
  'automaticMemoryInference',
  'sensitiveMemoryAllowed',
  'backgroundCredentialStorage',
  'teamMemoryAvailable',
  'externalActionWithoutApproval',
];
export type DwaionAiSourceKey = AgentSchemas['AiSourceKey'];
export type DwaionAiSourcePreference = AgentSchemas['AiSourcePreference'];
export type DwaionPersonalMemory = AgentSchemas['PersonalMemory'];
export type DwaionMemoryKind = AgentSchemas['MemoryKind'];
export type DwaionMemoryState = AgentSchemas['MemoryState'];
export type DwaionMemoryPreferenceState = AgentSchemas['MemoryPreferenceState'];
export type DwaionPersonalRetentionPolicy =
  AgentSchemas['dwp_agent__governed_domain_contracts__RetentionPolicy'];
export type DwaionPersonalDataCapabilities = AgentSchemas['PersonalDataGovernanceCapabilities'];
export type DwaionDeletionDomain = AgentSchemas['DomainKey'];
export type DwaionDeletionJob = AgentSchemas['DeletionJob'];

const CONTROL_BASE = '/api/agent/v1/ai-controls';
const PERSONAL_DATA_BASE = '/api/agent/v1/personal-data';
const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

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
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalMemory> {
  const body: AgentSchemas['CreateMemoryRequest'] = {
    ...newAgentCommand(0, 'USER_MEMORY_CREATE'),
    kind,
    memory: { value },
  };
  return mutateMemory(`${CONTROL_BASE}/memories`, body, 'post', authority);
}

export async function updateDwaionPersonalMemory(
  memoryId: string,
  expectedRevision: number,
  value: string,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalMemory> {
  const body: AgentSchemas['UpdateMemoryRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_UPDATE'),
    memory: { value },
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
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionDeletionJob> {
  const body: AgentSchemas['RequestDeletionRequest'] = {
    ...newAgentCommand(0, 'USER_DATA_DELETION'),
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
    typeof value.state === 'string' &&
    Number.isInteger(value.revision) &&
    isAgentRecord(value.memory) &&
    typeof value.memory.value === 'string' &&
    isAgentDate(value.createdAt) &&
    isAgentDate(value.updatedAt)
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
    typeof value.deletionCompletionClaimAvailable === 'boolean'
  );
}

function isDeletionJob(value: unknown): value is DwaionDeletionJob {
  return (
    isAgentRecord(value) &&
    typeof value.deletionJobId === 'string' &&
    typeof value.state === 'string' &&
    Array.isArray(value.domains) &&
    isAgentDate(value.requestedAt) &&
    typeof value.deletionPerformed === 'boolean' &&
    typeof value.deletionExecutionAvailable === 'boolean'
  );
}
