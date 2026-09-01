import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  ProviderAuditInsights,
  ProviderCommandCenter,
  ProviderCommercialOverview,
  ProviderEstateOverview,
  ProviderOperatorProfile,
  ProviderRegion,
  ProviderSubscriptionRenewalRevision,
} from './provider-control-contracts';

const BASE = '/api/provider/v1/admin';

export async function getProviderOperatorProfile(): Promise<ProviderOperatorProfile> {
  const response = await axiosInstance.get<ApiResponse<ProviderOperatorProfile>>(`${BASE}/me`, {
    timeoutMs: 5_000,
  });
  return response.data.data;
}

export async function getProviderEstateOverview(): Promise<ProviderEstateOverview> {
  const response = await axiosInstance.get<ApiResponse<ProviderEstateOverview>>(`${BASE}/overview`);
  return response.data.data;
}

export async function getProviderCommandCenter(): Promise<ProviderCommandCenter> {
  const response = await axiosInstance.get<ApiResponse<ProviderCommandCenter>>(
    `${BASE}/command-center`
  );
  return response.data.data;
}

export async function getProviderCommercialOverview(): Promise<ProviderCommercialOverview> {
  const response = await axiosInstance.get<ApiResponse<ProviderCommercialOverview>>(
    `${BASE}/commercial`
  );
  return response.data.data;
}

export async function listProviderSubscriptionRenewals(): Promise<
  ProviderSubscriptionRenewalRevision[]
> {
  const response = await axiosInstance.get<ApiResponse<ProviderSubscriptionRenewalRevision[]>>(
    `${BASE}/subscription-renewals`
  );
  return response.data.data;
}

export async function createProviderSubscriptionRenewal(request: {
  subscriptionId: string;
  targetPlanKey: string;
  proposedEndsAt: string;
  proposedContractReference: string;
  reason: string;
  requestKey: string;
  subscriptionVersion: number;
}): Promise<ProviderSubscriptionRenewalRevision> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSubscriptionRenewalRevision>,
    typeof request
  >(`${BASE}/subscription-renewals`, request);
  return response.data.data;
}

export async function decideProviderSubscriptionRenewal(
  revision: Pick<ProviderSubscriptionRenewalRevision, 'renewalRevisionId' | 'version'>,
  decision: 'APPROVED' | 'REJECTED',
  reason: string
): Promise<ProviderSubscriptionRenewalRevision> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSubscriptionRenewalRevision>,
    { decision: 'APPROVED' | 'REJECTED'; reason: string; version: number }
  >(`${BASE}/subscription-renewals/${revision.renewalRevisionId}/decision`, {
    decision,
    reason,
    version: revision.version,
  });
  return response.data.data;
}

export async function publishProviderSubscriptionRenewal(
  revision: Pick<ProviderSubscriptionRenewalRevision, 'renewalRevisionId' | 'version'>
): Promise<ProviderSubscriptionRenewalRevision> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSubscriptionRenewalRevision>,
    { version: number }
  >(`${BASE}/subscription-renewals/${revision.renewalRevisionId}/publish`, {
    version: revision.version,
  });
  return response.data.data;
}

export async function getProviderAuditInsights(): Promise<ProviderAuditInsights> {
  const response = await axiosInstance.get<ApiResponse<ProviderAuditInsights>>(
    `${BASE}/audit-insights`
  );
  return response.data.data;
}

export async function listProviderRegions(): Promise<ProviderRegion[]> {
  const response = await axiosInstance.get<ApiResponse<ProviderRegion[]>>(`${BASE}/regions`);
  return response.data.data;
}
