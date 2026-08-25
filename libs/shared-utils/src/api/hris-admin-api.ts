import { axiosInstance } from '../axios-instance';
import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from './product-surface-governed-mutation';
import { productSurfaceReadScopeConfig } from './product-surface-read-scope';

import type { ApiResponse } from '../types';
import type {
  CreateHrisConnectorRequest,
  HrisConfigurationCheck,
  HrisConnector,
  HrisImportResult,
  HrisMappingProfile,
  HrisReconciliationIssue,
  HrisReconciliationRun,
  HrisSourceSystem,
  HrisSyncRun,
} from './people-admin-api';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

const HRIS_BASE = '/api/people/v1/workforce/data-operations/hris';

export const HCM_HRIS_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createHrisConnector',
    routeContractKey: 'route.hcm.management.integration-create.action',
    method: 'POST',
    path: `${HRIS_BASE}/connectors`,
  },
  {
    apiFunction: 'createHrisMappingProfile',
    routeContractKey: 'route.hcm.management.integration-create.action',
    method: 'POST',
    path: `${HRIS_BASE}/mapping-profiles`,
  },
  {
    apiFunction: 'updateHrisConnector',
    routeContractKey: 'route.hcm.management.integration-update.action',
    method: 'PUT',
    path: `${HRIS_BASE}/connectors/{connectorId}`,
  },
  {
    apiFunction: 'activateHrisMappingProfile',
    routeContractKey: 'route.hcm.management.integration-update.action',
    method: 'POST',
    path: `${HRIS_BASE}/mapping-profiles/{mappingId}/activate`,
  },
  {
    apiFunction: 'resolveHrisReconciliationIssue',
    routeContractKey: 'route.hcm.management.integration-update.action',
    method: 'PUT',
    path: `${HRIS_BASE}/reconciliation-issues/{issueId}`,
  },
  {
    apiFunction: 'checkHrisConnectorConfiguration',
    routeContractKey: 'route.hcm.management.integration-execute.action',
    method: 'POST',
    path: `${HRIS_BASE}/connectors/{connectorId}/configuration-check`,
  },
  {
    apiFunction: 'executeHrisConnector',
    routeContractKey: 'route.hcm.management.integration-execute.action',
    method: 'POST',
    path: `${HRIS_BASE}/connectors/{connectorId}/executions`,
  },
  {
    apiFunction: 'retryHrisSyncRun',
    routeContractKey: 'route.hcm.management.integration-execute.action',
    method: 'POST',
    path: `${HRIS_BASE}/sync-runs/{syncRunId}/retry`,
  },
  {
    apiFunction: 'reconcileHrisRun',
    routeContractKey: 'route.hcm.management.integration-execute.action',
    method: 'POST',
    path: `${HRIS_BASE}/connectors/{connectorId}/reconciliations`,
  },
] as const;

export async function listHrisSources(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<HrisSourceSystem[]> {
  const response = await axiosInstance.get<ApiResponse<HrisSourceSystem[]>>(
    `${HRIS_BASE}/sources`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function listHrisConnectors(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<HrisConnector[]> {
  const response = await axiosInstance.get<ApiResponse<HrisConnector[]>>(
    `${HRIS_BASE}/connectors`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function createHrisConnector(
  request: CreateHrisConnectorRequest,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisConnector> {
  const response = await axiosInstance.post<ApiResponse<HrisConnector>, CreateHrisConnectorRequest>(
    `${HRIS_BASE}/connectors`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function updateHrisConnector(
  connector: HrisConnector,
  request: {
    endpointUri?: string;
    credentialReference?: string;
    scheduleExpression?: string;
    lifecycleState: string;
  },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisConnector> {
  const response = await axiosInstance.put<
    ApiResponse<HrisConnector>,
    typeof request & { version: number }
  >(
    `${HRIS_BASE}/connectors/${connector.connectorInstanceId}`,
    { ...request, version: connector.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function checkHrisConnectorConfiguration(
  connectorId: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisConfigurationCheck> {
  const response = await axiosInstance.post<ApiResponse<HrisConfigurationCheck>, undefined>(
    `${HRIS_BASE}/connectors/${connectorId}/configuration-check`,
    undefined,
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  return response.data.data;
}

export async function listHrisMappingProfiles(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<HrisMappingProfile[]> {
  const response = await axiosInstance.get<ApiResponse<HrisMappingProfile[]>>(
    `${HRIS_BASE}/mapping-profiles`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function listHrisSyncRuns(
  size = 50,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<HrisSyncRun[]> {
  const response = await axiosInstance.get<ApiResponse<HrisSyncRun[]>>(
    `${HRIS_BASE}/sync-runs?size=${size}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function executeHrisConnector(
  connectorId: string,
  syncMode: 'FULL' | 'DELTA',
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisImportResult> {
  const response = await axiosInstance.post<ApiResponse<HrisImportResult>, { syncMode: string }>(
    `${HRIS_BASE}/connectors/${connectorId}/executions`,
    { syncMode },
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  return response.data.data;
}

export async function retryHrisSyncRun(
  syncRunId: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisImportResult> {
  const response = await axiosInstance.post<ApiResponse<HrisImportResult>, undefined>(
    `${HRIS_BASE}/sync-runs/${syncRunId}/retry`,
    undefined,
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  return response.data.data;
}

export async function createHrisMappingProfile(
  request: {
    sourceSystemId: number;
    profileKey: string;
    adapterType: string;
    sourceSchemaVersion: string;
    targetSchemaVersion: string;
    mappingDefinition: Record<string, unknown>;
  },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisMappingProfile> {
  const response = await axiosInstance.post<ApiResponse<HrisMappingProfile>, typeof request>(
    `${HRIS_BASE}/mapping-profiles`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function activateHrisMappingProfile(
  mapping: HrisMappingProfile,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisMappingProfile> {
  const response = await axiosInstance.post<ApiResponse<HrisMappingProfile>, { version: number }>(
    `${HRIS_BASE}/mapping-profiles/${mapping.mappingProfileId}/activate`,
    { version: mapping.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function listHrisReconciliations(
  size = 50,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<HrisReconciliationRun[]> {
  const response = await axiosInstance.get<ApiResponse<HrisReconciliationRun[]>>(
    `${HRIS_BASE}/reconciliations?size=${size}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function reconcileHrisRun(
  connectorId: string,
  syncRunId: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisReconciliationRun> {
  const response = await axiosInstance.post<ApiResponse<HrisReconciliationRun>, undefined>(
    `${HRIS_BASE}/connectors/${connectorId}/reconciliations?syncRunId=${encodeURIComponent(syncRunId)}`,
    undefined,
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  return response.data.data;
}

export async function listHrisReconciliationIssues(
  state: 'OPEN' | 'RESOLVED' | 'ACCEPTED' | '' = 'OPEN',
  size = 100,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<HrisReconciliationIssue[]> {
  const query = new URLSearchParams({ size: String(size) });
  if (state) query.set('state', state);
  const response = await axiosInstance.get<ApiResponse<HrisReconciliationIssue[]>>(
    `${HRIS_BASE}/reconciliation-issues?${query.toString()}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function resolveHrisReconciliationIssue(
  issueId: string,
  lifecycleState: 'RESOLVED' | 'ACCEPTED',
  resolutionNote: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<void> {
  await axiosInstance.put<ApiResponse<void>, { lifecycleState: string; resolutionNote: string }>(
    `${HRIS_BASE}/reconciliation-issues/${issueId}`,
    { lifecycleState, resolutionNote },
    productSurfaceGovernedMutationConfig(authority)
  );
}

export async function importSyntheticWorkdayFixture(): Promise<HrisImportResult> {
  const response = await axiosInstance.post<ApiResponse<HrisImportResult>, undefined>(
    `${HRIS_BASE}/sample-import`,
    undefined,
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return response.data.data;
}
