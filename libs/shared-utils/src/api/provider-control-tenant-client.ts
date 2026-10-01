import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResult } from './platform-admin-api';
import type {
  OnboardingPlanRequest,
  ProviderDomainChallenge,
  ProviderEntitlement,
  ProviderOperation,
  ProviderOperationApproval,
  ProviderTenant,
  ProviderTenantDomain,
} from './provider-control-contracts';

const BASE = '/api/provider/v1/admin';
const COMPLETE_PAGE_SIZE = 100;

async function collectCompletePage<T>(
  firstPage: PageResult<T>,
  fetchPage: (page: number) => Promise<PageResult<T>>,
  identity: (item: T) => string
): Promise<PageResult<T>> {
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
      fetchPage(index + 1)
    )
  );
  const pages = [firstPage, ...remaining];
  const metadataConsistent = pages.every(
    (page, index) =>
      page.page === index &&
      page.totalPages === firstPage.totalPages &&
      page.totalElements === firstPage.totalElements
  );
  const content = pages.flatMap((page) => page.content);
  const identities = new Set(content.map(identity));
  if (
    !metadataConsistent ||
    content.length !== firstPage.totalElements ||
    identities.size !== content.length
  ) {
    throw new Error('PROVIDER_COMPLETE_LEDGER_COVERAGE_INCONSISTENT');
  }
  return {
    content,
    page: 0,
    size: content.length,
    totalElements: firstPage.totalElements,
    totalPages: firstPage.totalPages,
  };
}

export async function listProviderTenants(
  params: {
    query?: string;
    state?: string;
    region?: string;
    serviceTier?: string;
    isolationModel?: string;
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
  if (params.region) search.set('region', params.region);
  if (params.serviceTier) search.set('serviceTier', params.serviceTier);
  if (params.isolationModel) search.set('isolationModel', params.isolationModel);
  const response = await axiosInstance.get<ApiResponse<PageResult<ProviderTenant>>>(
    `${BASE}/tenants?${search.toString()}`
  );
  return response.data.data;
}

export async function listAllProviderTenants(): Promise<PageResult<ProviderTenant>> {
  const fetchPage = (page: number) => listProviderTenants({ page, size: COMPLETE_PAGE_SIZE });
  const firstPage = await fetchPage(0);
  return collectCompletePage(firstPage, fetchPage, (tenant) => tenant.tenantId);
}

export async function getProviderTenant(tenantId: string): Promise<ProviderTenant> {
  const response = await axiosInstance.get<ApiResponse<ProviderTenant>>(
    `${BASE}/tenants/${tenantId}`
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

export async function retryProviderOperation(
  operation: ProviderOperation,
  justification: string
): Promise<ProviderOperation> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderOperation>,
    { justification: string; version: number }
  >(`${BASE}/operations/${operation.operationId}/retry`, {
    justification,
    version: operation.version,
  });
  return response.data.data;
}

export async function listProviderOperations(): Promise<PageResult<ProviderOperation>> {
  const fetchPage = async (page: number) => {
    const response = await axiosInstance.get<ApiResponse<PageResult<ProviderOperation>>>(
      `${BASE}/operations?page=${page}&size=${COMPLETE_PAGE_SIZE}`
    );
    return response.data.data;
  };
  const firstPage = await fetchPage(0);
  return collectCompletePage(firstPage, fetchPage, (operation) => operation.operationId);
}

export async function listProviderOperationApprovals(
  state?: string
): Promise<ProviderOperationApproval[]> {
  const search = state ? `?state=${encodeURIComponent(state)}` : '';
  const response = await axiosInstance.get<ApiResponse<ProviderOperationApproval[]>>(
    `${BASE}/operation-approvals${search}`
  );
  return response.data.data;
}

export async function decideProviderOperationApproval(
  approval: ProviderOperationApproval,
  decision: 'APPROVED' | 'REJECTED',
  reason: string
): Promise<ProviderOperationApproval> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderOperationApproval>,
    { decision: string; reason: string; version: number }
  >(`${BASE}/operation-approvals/${approval.operationApprovalId}/decision`, {
    decision,
    reason,
    version: approval.version,
  });
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

export async function createProviderTenantDomain(
  tenantId: string,
  request: { domainName: string; domainType: string; primaryDomain: boolean }
): Promise<ProviderDomainChallenge> {
  const response = await axiosInstance.post<ApiResponse<ProviderDomainChallenge>, typeof request>(
    `${BASE}/tenants/${tenantId}/domains`,
    request
  );
  return response.data.data;
}

export async function getProviderDomainChallenge(
  tenantId: string,
  domainId: string
): Promise<ProviderDomainChallenge> {
  const response = await axiosInstance.get<ApiResponse<ProviderDomainChallenge>>(
    `${BASE}/tenants/${tenantId}/domains/${domainId}/challenge`
  );
  return response.data.data;
}

export async function verifyProviderTenantDomain(
  tenantId: string,
  domain: ProviderTenantDomain,
  justification: string
): Promise<ProviderTenantDomain> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderTenantDomain>,
    { justification: string; version: number }
  >(`${BASE}/tenants/${tenantId}/domains/${domain.domainId}/verify`, {
    justification,
    version: domain.version,
  });
  return response.data.data;
}
