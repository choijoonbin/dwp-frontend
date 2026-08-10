import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResult } from './platform-admin-api';

export type ProviderEntitlement = {
  entitlementId: number;
  entitlementKey: string;
  name: string;
  entitlementType: string;
  lifecycleState: string;
  configuration: string;
  version: number;
};

export type ProviderTenant = {
  tenantId: string;
  tenantKey: string;
  displayName: string;
  serviceTier: 'STANDARD' | 'ENTERPRISE' | 'REGULATED';
  dataRegion: string;
  isolationModel: 'POOL' | 'BRIDGE' | 'SILO';
  lifecycleState: string;
  onboardingState: string;
  authTenantId?: number | null;
  version: number;
  entitlements: ProviderEntitlement[];
};

export type ProviderOperationStep = {
  order: number;
  stepKey: string;
  lifecycleState: string;
  targetService: string;
  externalReference?: string | null;
  redactedResult: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type ProviderOperation = {
  operationId: string;
  tenantId?: string | null;
  operationType: string;
  lifecycleState: string;
  riskTier: string;
  planHash: string;
  plan: string;
  failureCode?: string | null;
  failureMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  version: number;
  steps: ProviderOperationStep[];
};

export type OnboardingPlanRequest = {
  tenantKey: string;
  displayName: string;
  serviceTier: ProviderTenant['serviceTier'];
  dataRegion: string;
  isolationModel: ProviderTenant['isolationModel'];
  entitlementKeys: string[];
  justification: string;
};

const BASE = '/api/provider/v1/admin';

export async function listProviderTenants(
  params: {
    query?: string;
    state?: string;
    page?: number;
    size?: number;
  } = {}
): Promise<PageResult<ProviderTenant>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 50),
  });
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.state) search.set('state', params.state);
  const response = await axiosInstance.get<ApiResponse<PageResult<ProviderTenant>>>(
    `${BASE}/tenants?${search.toString()}`
  );
  return response.data.data;
}

export async function listProviderEntitlements(): Promise<ProviderEntitlement[]> {
  const response = await axiosInstance.get<ApiResponse<ProviderEntitlement[]>>(
    `${BASE}/entitlements`
  );
  return response.data.data;
}

export async function previewProviderOnboarding(
  request: OnboardingPlanRequest
): Promise<ProviderOperation> {
  const response = await axiosInstance.post<ApiResponse<ProviderOperation>, OnboardingPlanRequest>(
    `${BASE}/onboarding-plans`,
    request,
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return response.data.data;
}

export async function executeProviderOperation(
  operation: ProviderOperation
): Promise<ProviderOperation> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderOperation>,
    { planHash: string; version: number }
  >(`${BASE}/operations/${operation.operationId}/execute`, {
    planHash: operation.planHash,
    version: operation.version,
  });
  return response.data.data;
}

export async function listProviderOperations(): Promise<PageResult<ProviderOperation>> {
  const response = await axiosInstance.get<ApiResponse<PageResult<ProviderOperation>>>(
    `${BASE}/operations?page=0&size=100`
  );
  return response.data.data;
}

export async function updateProviderTenantLifecycle(
  tenant: ProviderTenant,
  state: 'ACTIVE' | 'SUSPENDED',
  justification: string
): Promise<ProviderTenant> {
  const response = await axiosInstance.patch<
    ApiResponse<ProviderTenant>,
    { state: string; justification: string; version: number }
  >(`${BASE}/tenants/${tenant.tenantId}/lifecycle`, {
    state,
    justification,
    version: tenant.version,
  });
  return response.data.data;
}

export async function replaceProviderTenantEntitlements(
  tenant: ProviderTenant,
  entitlementKeys: string[],
  justification: string
): Promise<ProviderTenant> {
  const response = await axiosInstance.put<
    ApiResponse<ProviderTenant>,
    { entitlementKeys: string[]; justification: string; version: number }
  >(`${BASE}/tenants/${tenant.tenantId}/entitlements`, {
    entitlementKeys,
    justification,
    version: tenant.version,
  });
  return response.data.data;
}
