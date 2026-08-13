import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResult, ReferenceLifecycle } from './platform-admin-api';

export type RegistryType =
  | 'APP'
  | 'CONNECTOR'
  | 'AGENT'
  | 'TOOL'
  | 'POLICY'
  | 'API'
  | 'DATA_PRODUCT';
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

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

function entryPath(entry: Pick<RegistryEntry, 'registryType' | 'entryKey'>): string {
  return `/api/platform/v1/admin/registry-entries/${entry.registryType}/${encodePath(entry.entryKey)}`;
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
