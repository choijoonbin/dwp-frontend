import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';
import type { PageResult, ReferenceLifecycle } from './platform-admin-api';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

export type RegistryType =
  'APP' | 'CONNECTOR' | 'AGENT' | 'TOOL' | 'POLICY' | 'API' | 'DATA_PRODUCT';
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

type PlatformSchemas = GatewayComponents['schemas'];

export type LocalizedCatalogText = PlatformSchemas['platform_LocalizedCatalogText'];

export type AgentCatalogCategory = PlatformSchemas['platform_AgentCatalogProfile']['category'];

export type AgentCatalogSource = PlatformSchemas['platform_AgentCatalogSource'];

export type AgentCatalogProfile = Omit<
  PlatformSchemas['platform_AgentCatalogProfile'],
  'schemaVersion' | 'humanConfirmationRequired'
> & {
  schemaVersion: 1;
  humanConfirmationRequired: boolean;
};

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
  agentCatalogProfile?: AgentCatalogProfile | null;
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
> & {
  updatedAt?: string | null;
  agentCatalogProfile?: AgentCatalogProfile | null;
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
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/platform/v1/catalog/registry-entries${search}`
  );
  if (!Array.isArray(response.data.data) || !response.data.data.every(isRuntimeRegistryEntry)) {
    throw new HttpError('Runtime registry response is invalid.', 502, response.data);
  }
  return response.data.data;
}

function isRuntimeRegistryEntry(value: unknown): value is RuntimeRegistryEntry {
  if (!record(value)) return false;
  return (
    REGISTRY_TYPES.has(value.registryType) &&
    nonBlank(value.entryKey, 100) &&
    Number.isInteger(value.revision) &&
    Number(value.revision) > 0 &&
    nonBlank(value.name, 160) &&
    (value.description == null || typeof value.description === 'string') &&
    nonBlank(value.ownerRef, 160) &&
    RISK_TIERS.has(value.riskTier) &&
    nonBlank(value.artifactVersion, 64) &&
    (value.updatedAt == null || validDate(value.updatedAt)) &&
    (value.agentCatalogProfile == null || isAgentCatalogProfile(value.agentCatalogProfile))
  );
}

function isAgentCatalogProfile(value: unknown): value is AgentCatalogProfile {
  if (!record(value)) return false;
  const sourceSystems = new Set<string>();
  return (
    value.schemaVersion === 1 &&
    (value.category === 'GENERAL' || value.category === 'APPROVAL') &&
    isLocalizedText(value.displayName) &&
    isLocalizedText(value.description) &&
    localizedList(value.capabilities, 1, 8) &&
    localizedList(value.boundaries, 1, 8) &&
    boundedArray(value.sources, 1, 8) &&
    value.sources.every((source) => {
      if (!isAgentCatalogSource(source) || sourceSystems.has(source.sourceSystem)) return false;
      sourceSystems.add(source.sourceSystem);
      return true;
    }) &&
    localizedList(value.starterPrompts, 1, 6) &&
    isLocalizedText(value.safetySummary) &&
    typeof value.humanConfirmationRequired === 'boolean'
  );
}

function isAgentCatalogSource(value: unknown): value is AgentCatalogSource {
  return (
    record(value) &&
    nonBlank(value.sourceSystem, 64) &&
    /^[A-Z][A-Z0-9_]{0,63}$/.test(value.sourceSystem) &&
    isLocalizedText(value.displayName) &&
    boundedArray(value.requiredPermissions, 1, 8) &&
    value.requiredPermissions.every(
      (permission) =>
        typeof permission === 'string' &&
        /^[A-Z][A-Z0-9_.-]{0,99}:[A-Z][A-Z0-9_.-]{0,39}$/.test(permission)
    ) &&
    value.permissionMatch === 'ANY_OF' &&
    value.accessMode === 'READ_ONLY'
  );
}

function localizedList(value: unknown, min: number, max: number): value is LocalizedCatalogText[] {
  return boundedArray(value, min, max) && value.every(isLocalizedText);
}

function isLocalizedText(value: unknown): value is LocalizedCatalogText {
  return record(value) && nonBlank(value.ko, 1000) && nonBlank(value.en, 1000);
}

function boundedArray(value: unknown, min: number, max: number): value is unknown[] {
  return Array.isArray(value) && value.length >= min && value.length <= max;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonBlank(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

const REGISTRY_TYPES = new Set<unknown>([
  'APP',
  'CONNECTOR',
  'AGENT',
  'TOOL',
  'POLICY',
  'API',
  'DATA_PRODUCT',
]);
const RISK_TIERS = new Set<unknown>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

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
  request: CreateDwaionAgentRequest,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, CreateDwaionAgentRequest>(
    '/api/platform/v1/admin/dwaion/agents',
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function createDwaionAdminAgentRevision(
  entry: RegistryEntry,
  request: RegistryDefinitionRequest,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, RegistryDefinitionRequest>(
    `${dwaionAgentPath(entry.entryKey)}/revisions`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function updateDwaionAdminAgentRevision(
  entry: RegistryEntry,
  request: UpdateRegistryRevisionRequest,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<RegistryEntry> {
  const response = await axiosInstance.patch<
    ApiResponse<RegistryEntry>,
    UpdateRegistryRevisionRequest
  >(
    `${dwaionAgentPath(entry.entryKey)}/revisions/${entry.revision}`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function activateDwaionAdminAgentRevision(
  entry: RegistryEntry,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, { version: number }>(
    `${dwaionAgentPath(entry.entryKey)}/revisions/${entry.revision}/activate`,
    { version: entry.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function retireDwaionAdminAgentRevision(
  entry: RegistryEntry,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<RegistryEntry> {
  const response = await axiosInstance.post<ApiResponse<RegistryEntry>, { version: number }>(
    `${dwaionAgentPath(entry.entryKey)}/revisions/${entry.revision}/retire`,
    { version: entry.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}
