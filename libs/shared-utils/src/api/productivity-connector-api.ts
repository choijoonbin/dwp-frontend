import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type ProductivityProviderType = 'MICROSOFT_GRAPH';
export type ProductivityAuthMode = 'DELEGATED';
export type ProductivityConnectorLifecycle = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
export type ProductivityConnectorHealth =
  | 'CONFIGURATION_REQUIRED'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'AUTHENTICATION_REQUIRED'
  | 'UNAVAILABLE';
export type ProductivityPolicyState = 'REVIEW_REQUIRED' | 'APPROVED' | 'BLOCKED';
export type ProductivityConsentState =
  | 'NOT_CONNECTED'
  | 'CONNECTED'
  | 'REAUTHORIZATION_REQUIRED'
  | 'REVOKED';
export type ProductivityResourceKind = 'MAIL' | 'CALENDAR';
export type ProductivitySyncMode = 'INITIAL' | 'DELTA' | 'RESET';
export type ProductivitySyncRunState = 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'BLOCKED';

export type ProductivityConnector = {
  connectorId: string;
  connectorKey: string;
  displayName: string;
  providerType: ProductivityProviderType;
  authMode: ProductivityAuthMode;
  providerTenantId?: string | null;
  clientId?: string | null;
  credentialReference?: string | null;
  redirectUri?: string | null;
  requestedScopes: string[];
  capabilities: string[];
  lifecycleState: ProductivityConnectorLifecycle;
  healthState: ProductivityConnectorHealth;
  policyState: ProductivityPolicyState;
  safeErrorCode?: string | null;
  lastConfigurationCheckAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  consecutiveFailures: number;
  version: number;
};

export type ProductivitySyncRun = {
  runId: string;
  connectorId: string;
  userId: number;
  resourceKind: ProductivityResourceKind;
  syncMode: ProductivitySyncMode;
  runState: ProductivitySyncRunState;
  startedAt: string;
  completedAt?: string | null;
  upsertCount: number;
  deleteCount: number;
  skipCount: number;
  errorCount: number;
  partialResult: boolean;
  retryAfterAt?: string | null;
  safeErrorCode?: string | null;
  correlationId?: string | null;
};

export type ProductivitySubject = {
  subjectId: string;
  connectorId: string;
  userId: number;
  consentState: ProductivityConsentState;
  grantedScopes: string[];
  tokenExpiresAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastErrorCode?: string | null;
};

export type ProductivityOverview = {
  connectors: number;
  activeConnectors: number;
  connectedSubjects: number;
  staleStreams: number;
  failedRuns24h: number;
  lastSuccessfulSyncAt?: string | null;
  connectorHealth: ProductivityConnector[];
  recentRuns: ProductivitySyncRun[];
};

export type SaveProductivityConnectorRequest = {
  connectorKey: string;
  displayName: string;
  providerType: ProductivityProviderType;
  authMode: ProductivityAuthMode;
  providerTenantId: string;
  clientId: string;
  credentialReference: string;
  redirectUri: string;
  requestedScopes: string[];
  policyState: ProductivityPolicyState;
  version?: number;
};

export type ProductivityConfigurationCheck = {
  connectorId: string;
  ready: boolean;
  healthState: ProductivityConnectorHealth;
  checks: string[];
  blockingCodes: string[];
  checkedAt: string;
};

const BASE = '/api/platform/v1/admin/integrations/productivity';

export async function getProductivityOverview(): Promise<ProductivityOverview> {
  const response = await axiosInstance.get<ApiResponse<ProductivityOverview>>(`${BASE}/overview`);
  return response.data.data;
}

export async function createProductivityConnector(
  request: SaveProductivityConnectorRequest
): Promise<ProductivityConnector> {
  const response = await axiosInstance.post<
    ApiResponse<ProductivityConnector>,
    SaveProductivityConnectorRequest
  >(`${BASE}/connectors`, request);
  return response.data.data;
}

export async function updateProductivityConnector(
  connectorId: string,
  request: SaveProductivityConnectorRequest
): Promise<ProductivityConnector> {
  const response = await axiosInstance.put<
    ApiResponse<ProductivityConnector>,
    SaveProductivityConnectorRequest
  >(`${BASE}/connectors/${connectorId}`, request);
  return response.data.data;
}

export async function checkProductivityConnector(
  connectorId: string
): Promise<ProductivityConfigurationCheck> {
  const response = await axiosInstance.post<ApiResponse<ProductivityConfigurationCheck>>(
    `${BASE}/connectors/${connectorId}/configuration-check`,
    {}
  );
  return response.data.data;
}

export async function activateProductivityConnector(
  connectorId: string,
  version: number
): Promise<ProductivityConnector> {
  const response = await axiosInstance.post<
    ApiResponse<ProductivityConnector>,
    { version: number }
  >(`${BASE}/connectors/${connectorId}/activate`, { version });
  return response.data.data;
}

export async function suspendProductivityConnector(
  connectorId: string,
  version: number
): Promise<ProductivityConnector> {
  const response = await axiosInstance.post<
    ApiResponse<ProductivityConnector>,
    { version: number }
  >(`${BASE}/connectors/${connectorId}/suspend`, { version });
  return response.data.data;
}

export async function listProductivitySubjects(limit = 200): Promise<ProductivitySubject[]> {
  const response = await axiosInstance.get<ApiResponse<ProductivitySubject[]>>(
    `${BASE}/subjects?limit=${limit}`
  );
  return response.data.data;
}

export async function listProductivityRuns(limit = 200): Promise<ProductivitySyncRun[]> {
  const response = await axiosInstance.get<ApiResponse<ProductivitySyncRun[]>>(
    `${BASE}/runs?limit=${limit}`
  );
  return response.data.data;
}
