import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  ProviderDataGovernanceSnapshot,
  ProviderDataPolicy,
  ProviderDataPolicyRevision,
} from './provider-control-contracts';

const BASE = '/api/provider/v1/admin';

export async function getProviderDataGovernance(): Promise<ProviderDataGovernanceSnapshot> {
  const response = await axiosInstance.get<ApiResponse<ProviderDataGovernanceSnapshot>>(
    `${BASE}/data-governance`
  );
  return response.data.data;
}

export async function refreshProviderDataGovernance(): Promise<ProviderDataGovernanceSnapshot> {
  const response = await axiosInstance.post<ApiResponse<ProviderDataGovernanceSnapshot>, undefined>(
    `${BASE}/data-governance/refresh`,
    undefined
  );
  return response.data.data;
}

export async function listProviderDataPolicies(): Promise<ProviderDataPolicy[]> {
  const response = await axiosInstance.get<ApiResponse<ProviderDataPolicy[]>>(
    `${BASE}/data-governance/policies`
  );
  return response.data.data;
}

export async function createProviderDataPolicy(request: {
  policyKey: string;
  displayName: string;
  description: string;
  policyType: ProviderDataPolicy['policyType'];
  scopeType: ProviderDataPolicy['scopeType'];
  scopeRef?: string | null;
  ownerService: string;
  policyRule: Record<string, unknown>;
  justification: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}): Promise<ProviderDataPolicy> {
  const response = await axiosInstance.post<ApiResponse<ProviderDataPolicy>, typeof request>(
    `${BASE}/data-governance/policies`,
    request
  );
  return response.data.data;
}

export async function createProviderDataPolicyRevision(
  policyId: string,
  request: {
    policyRule: Record<string, unknown>;
    justification: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }
): Promise<ProviderDataPolicyRevision> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderDataPolicyRevision>,
    typeof request
  >(`${BASE}/data-governance/policies/${policyId}/revisions`, request);
  return response.data.data;
}

async function transitionProviderDataPolicy(
  revision: ProviderDataPolicyRevision,
  action: 'impact-preview' | 'submit' | 'publish' | 'rollback-request',
  reason: string
): Promise<ProviderDataPolicyRevision> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderDataPolicyRevision>,
    { version: number; reason: string }
  >(`${BASE}/data-governance/policies/revisions/${revision.revisionId}/${action}`, {
    version: revision.version,
    reason,
  });
  return response.data.data;
}

export const previewProviderDataPolicy = (revision: ProviderDataPolicyRevision, reason: string) =>
  transitionProviderDataPolicy(revision, 'impact-preview', reason);

export const submitProviderDataPolicy = (revision: ProviderDataPolicyRevision, reason: string) =>
  transitionProviderDataPolicy(revision, 'submit', reason);

export const publishProviderDataPolicy = (revision: ProviderDataPolicyRevision, reason: string) =>
  transitionProviderDataPolicy(revision, 'publish', reason);

export const rollbackProviderDataPolicy = (revision: ProviderDataPolicyRevision, reason: string) =>
  transitionProviderDataPolicy(revision, 'rollback-request', reason);

export async function decideProviderDataPolicy(
  revision: ProviderDataPolicyRevision,
  decision: 'APPROVED' | 'REJECTED',
  reason: string
): Promise<ProviderDataPolicyRevision> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderDataPolicyRevision>,
    { version: number; decision: string; reason: string }
  >(`${BASE}/data-governance/policies/revisions/${revision.revisionId}/approval`, {
    version: revision.version,
    decision,
    reason,
  });
  return response.data.data;
}
