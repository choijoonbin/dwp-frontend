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

type AgentSchemas = AgentComponents['schemas'];

export type DwaionPersonalAiControls = AgentSchemas['PersonalAiControls'];
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

export async function getDwaionPersonalAiControls(): Promise<DwaionPersonalAiControls> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(CONTROL_BASE);
  return expectAgentData(
    response.data.data,
    isControls,
    'Personal AI controls response is invalid.'
  );
}

export async function updateDwaionMemoryPreference(
  expectedRevision: number,
  memoryState: Extract<DwaionMemoryPreferenceState, 'ENABLED' | 'DISABLED'>
): Promise<DwaionPersonalAiControls> {
  const body: AgentSchemas['UpdateMemoryPreferenceRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_PREFERENCE'),
    memoryState,
    changeReason: 'The user explicitly changed personal AI memory storage.',
  };
  const response = await axiosInstance.put<ApiResponse<unknown>, typeof body>(CONTROL_BASE, body);
  return expectAgentData(
    response.data.data,
    isControls,
    'Personal AI controls response is invalid.'
  );
}

export async function updateDwaionSourcePreference(
  sourceKey: DwaionAiSourceKey,
  expectedRevision: number,
  enabled: boolean
): Promise<DwaionAiSourcePreference> {
  const body: AgentSchemas['UpdateAiSourcePreferenceRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_SOURCE_PREFERENCE'),
    enabled,
    changeReason: 'The user explicitly changed a personal AI source boundary.',
  };
  const response = await axiosInstance.put<ApiResponse<unknown>, typeof body>(
    `${CONTROL_BASE}/sources/${encodeURIComponent(sourceKey)}`,
    body
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
  value: string
): Promise<DwaionPersonalMemory> {
  const body: AgentSchemas['CreateMemoryRequest'] = {
    ...newAgentCommand(0, 'USER_MEMORY_CREATE'),
    kind,
    memory: { value },
  };
  return mutateMemory(`${CONTROL_BASE}/memories`, body, 'post');
}

export async function updateDwaionPersonalMemory(
  memoryId: string,
  expectedRevision: number,
  value: string
): Promise<DwaionPersonalMemory> {
  const body: AgentSchemas['UpdateMemoryRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_UPDATE'),
    memory: { value },
  };
  return mutateMemory(`${CONTROL_BASE}/memories/${encodeMemoryId(memoryId)}`, body, 'put');
}

export async function changeDwaionPersonalMemoryState(
  memoryId: string,
  expectedRevision: number,
  memoryState: Extract<DwaionMemoryState, 'ACTIVE' | 'DISABLED'>
): Promise<DwaionPersonalMemory> {
  const body: AgentSchemas['ChangeMemoryStateRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_STATE'),
    memoryState,
    changeReason: 'The user explicitly changed a personal AI memory state.',
  };
  return mutateMemory(`${CONTROL_BASE}/memories/${encodeMemoryId(memoryId)}/state`, body, 'post');
}

export async function deleteDwaionPersonalMemory(
  memoryId: string,
  expectedRevision: number
): Promise<DwaionPersonalMemory> {
  const body: AgentSchemas['DeleteMemoryRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_MEMORY_DELETE'),
    changeReason: 'The user explicitly deleted this personal AI memory.',
  };
  return mutateMemory(`${CONTROL_BASE}/memories/${encodeMemoryId(memoryId)}/delete`, body, 'post');
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
  domains: DwaionDeletionDomain[]
): Promise<DwaionDeletionJob> {
  const body: AgentSchemas['RequestDeletionRequest'] = {
    ...newAgentCommand(0, 'USER_DATA_DELETION'),
    domains,
    changeReason: 'The user explicitly requested deletion of personal AI data.',
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${PERSONAL_DATA_BASE}/deletions`,
    body
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
  method: 'post' | 'put'
): Promise<DwaionPersonalMemory> {
  const response =
    method === 'post'
      ? await axiosInstance.post<ApiResponse<unknown>, object>(url, body)
      : await axiosInstance.put<ApiResponse<unknown>, object>(url, body);
  return expectAgentData(response.data.data, isMemory, 'Personal AI memory response is invalid.');
}

function encodeMemoryId(memoryId: string): string {
  assertAgentUuid(memoryId, 'Personal AI memory identifier');
  return encodeURIComponent(memoryId);
}

function isControls(value: unknown): value is DwaionPersonalAiControls {
  return (
    isAgentRecord(value) &&
    typeof value.memoryState === 'string' &&
    Number.isInteger(value.revision) &&
    typeof value.memoryEnabled === 'boolean' &&
    typeof value.memoryEffective === 'boolean' &&
    Array.isArray(value.sourcePreferences) &&
    value.sourcePreferences.every(isSourcePreference)
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
