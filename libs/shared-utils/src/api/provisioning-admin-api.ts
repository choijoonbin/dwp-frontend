import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type ScimConnector = {
  connectorId: string;
  connectorKey: string;
  displayName: string;
  tokenPrefix: string;
  allowedOperations: string[];
  lifecycleState: 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
  lastUsedAt?: string | null;
  health: 'READY' | 'PENDING' | 'ATTENTION' | 'SUSPENDED' | 'RETIRED';
  events24h: number;
  failedEvents24h: number;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  version: number;
};

export type ScimProvisioningEvent = {
  eventId: string;
  connectorId: string;
  connectorName: string;
  operation: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  correlationId?: string | null;
  summary: string;
  occurredAt: string;
};

export type ScimCredentialIssued = {
  connector: ScimConnector;
  bearerToken: string;
};

const BASE = '/api/auth/admin/provisioning/scim/connectors';

export async function listScimConnectors(): Promise<ScimConnector[]> {
  const response = await axiosInstance.get<ApiResponse<ScimConnector[]>>(BASE);
  return response.data.data;
}

export async function listScimProvisioningEvents(
  connectorId?: string,
  limit = 100
): Promise<ScimProvisioningEvent[]> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (connectorId) search.set('connectorId', connectorId);
  const response = await axiosInstance.get<ApiResponse<ScimProvisioningEvent[]>>(
    `${BASE}/events?${search.toString()}`
  );
  return response.data.data;
}

export async function createScimConnector(request: {
  connectorKey: string;
  displayName: string;
}): Promise<ScimCredentialIssued> {
  const response = await axiosInstance.post<ApiResponse<ScimCredentialIssued>, typeof request>(
    BASE,
    request
  );
  return response.data.data;
}

export async function rotateScimConnectorSecret(
  connectorId: string
): Promise<ScimCredentialIssued> {
  const response = await axiosInstance.post<ApiResponse<ScimCredentialIssued>, undefined>(
    `${BASE}/${encodeURIComponent(connectorId)}/rotate-secret`,
    undefined
  );
  return response.data.data;
}

export async function changeScimConnectorLifecycle(
  connectorId: string,
  state: ScimConnector['lifecycleState']
): Promise<ScimConnector> {
  const response = await axiosInstance.patch<
    ApiResponse<ScimConnector>,
    { state: ScimConnector['lifecycleState'] }
  >(`${BASE}/${encodeURIComponent(connectorId)}/lifecycle`, { state });
  return response.data.data;
}
