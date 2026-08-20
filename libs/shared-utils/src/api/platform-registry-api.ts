import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResult, ReferenceLifecycle } from './platform-admin-api';

export type RegistryType =
  'APP' | 'CONNECTOR' | 'AGENT' | 'TOOL' | 'POLICY' | 'API' | 'DATA_PRODUCT';
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RegistryEntry = {
  registryType: RegistryType;
  entryKey: string;
  revision: number;
  name: string;
  description?: string | null;
  ownerRef: string;
  riskTier: RiskTier;
  artifactVersion: string;
  lifecycleState: ReferenceLifecycle;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type RuntimeRegistryEntry = Pick<
  RegistryEntry,
  | 'registryType'
  | 'entryKey'
  | 'revision'
  | 'name'
  | 'description'
  | 'ownerRef'
  | 'riskTier'
  | 'artifactVersion'
>;

export type RegistryEntryDetail = {
  current: RegistryEntry;
  history: RegistryEntry[];
};

export type RegistryDefinitionRequest = Pick<
  RegistryEntry,
  'name' | 'description' | 'ownerRef' | 'riskTier' | 'artifactVersion'
>;

export type CreateRegistryEntryRequest = RegistryDefinitionRequest & {
  registryType: RegistryType;
  entryKey: string;
};

export type UpdateRegistryRevisionRequest = RegistryDefinitionRequest & {
  version: number;
};

export type CreateDwaionAgentRequest = RegistryDefinitionRequest & {
  entryKey: string;
};

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

function entryPath(entry: Pick<RegistryEntry, 'registryType' | 'entryKey'>): string {
  return `/api/platform/v1/admin/registry-entries/${entry.registryType}/${encodePath(entry.entryKey)}`;
}

export async function listRuntimeRegistryEntries(
  registryType?: RegistryType
): Promise<RuntimeRegistryEntry[]> {
  const search = registryType ? `?registryType=${encodeURIComponent(registryType)}` : '';
  const response = await axiosInstance.get<ApiResponse<RuntimeRegistryEntry[]>>(
    `/api/platform/v1/catalog/registry-entries${search}`
  );
  return response.data.data;
}

export async function listRegistryEntries(options?: {
  query?: string;
  registryType?: RegistryType | 'ALL';
  lifecycle?: ReferenceLifecycle | 'ALL';
}): Promise<PageResult<RegistryEntry>> {
  const search = new URLSearchParams({ page: '0', size: '100' });
  if (options?.query?.trim()) search.set('query', options.query.trim());
  if (options?.registryType && options.registryType !== 'ALL') {
    search.set('registryType', options.registryType);
  }
  if (options?.lifecycle && options.lifecycle !== 'ALL') {
    search.set('lifecycle', options.lifecycle);
  }
  const response = await axiosInstance.get<ApiResponse<PageResult<RegistryEntry>>>(
    `/api/platform/v1/admin/registry-entries?${search.toString()}`
  );
  return response.data.data;
}

export async function getRegistryEntry(
  registryType: RegistryType,
  entryKey: string
): Promise<RegistryEntryDetail> {
  const response = await axiosInstance.get<ApiResponse<RegistryEntryDetail>>(
    entryPath({ registryType, entryKey })
  );
  return response.data.data;
}

export async function createRegistryEntry(
  request: CreateRegistryEntryRequest
): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, CreateRegistryEntryRequest>(
    '/api/platform/v1/admin/registry-entries',
    request
  );
  return response.data.data;
}

export async function createRegistryRevision(
  entry: RegistryEntry,
  request: RegistryDefinitionRequest
): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, RegistryDefinitionRequest>(
    `${entryPath(entry)}/revisions`,
    request
  );
  return response.data.data;
}

export async function updateRegistryRevision(
  entry: RegistryEntry,
  request: UpdateRegistryRevisionRequest
): Promise<RegistryEntry> {
  const response = await axiosInstance.patch<
    ApiResponse<RegistryEntry>,
    UpdateRegistryRevisionRequest
  >(`${entryPath(entry)}/revisions/${entry.revision}`, request);
  return response.data.data;
}

export async function activateRegistryRevision(entry: RegistryEntry): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, { version: number }>(
    `${entryPath(entry)}/revisions/${entry.revision}/activate`,
    { version: entry.version }
  );
  return response.data.data;
}

export async function retireRegistryRevision(entry: RegistryEntry): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, { version: number }>(
    `${entryPath(entry)}/revisions/${entry.revision}/retire`,
    { version: entry.version }
  );
  return response.data.data;
}

function dwaionAgentPath(entryKey: string): string {
  return `/api/platform/v1/admin/dwaion/agents/${encodePath(entryKey)}`;
}

export async function listDwaionAdminAgents(options?: {
  query?: string;
  lifecycle?: ReferenceLifecycle | 'ALL';
}): Promise<PageResult<RegistryEntry>> {
  const search = new URLSearchParams({ page: '0', size: '100' });
  if (options?.query?.trim()) search.set('query', options.query.trim());
  if (options?.lifecycle && options.lifecycle !== 'ALL') {
    search.set('lifecycle', options.lifecycle);
  }
  const response = await axiosInstance.get<ApiResponse<PageResult<RegistryEntry>>>(
    `/api/platform/v1/admin/dwaion/agents?${search.toString()}`
  );
  return response.data.data;
}

export async function getDwaionAdminAgent(entryKey: string): Promise<RegistryEntryDetail> {
  const response = await axiosInstance.get<ApiResponse<RegistryEntryDetail>>(
    dwaionAgentPath(entryKey)
  );
  return response.data.data;
}

export async function createDwaionAdminAgent(
  request: CreateDwaionAgentRequest
): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, CreateDwaionAgentRequest>(
    '/api/platform/v1/admin/dwaion/agents',
    request
  );
  return response.data.data;
}

export async function createDwaionAdminAgentRevision(
  entry: RegistryEntry,
  request: RegistryDefinitionRequest
): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, RegistryDefinitionRequest>(
    `${dwaionAgentPath(entry.entryKey)}/revisions`,
    request
  );
  return response.data.data;
}

export async function updateDwaionAdminAgentRevision(
  entry: RegistryEntry,
  request: UpdateRegistryRevisionRequest
): Promise<RegistryEntry> {
  const response = await axiosInstance.patch<
    ApiResponse<RegistryEntry>,
    UpdateRegistryRevisionRequest
  >(`${dwaionAgentPath(entry.entryKey)}/revisions/${entry.revision}`, request);
  return response.data.data;
}

export async function activateDwaionAdminAgentRevision(
  entry: RegistryEntry
): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, { version: number }>(
    `${dwaionAgentPath(entry.entryKey)}/revisions/${entry.revision}/activate`,
    { version: entry.version }
  );
  return response.data.data;
}

export async function retireDwaionAdminAgentRevision(entry: RegistryEntry): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, { version: number }>(
    `${dwaionAgentPath(entry.entryKey)}/revisions/${entry.revision}/retire`,
    { version: entry.version }
  );
  return response.data.data;
}
