import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const BASE = '/api/auth/admin/tenant-settings';

export type TenantAuthPolicyDraft = {
  defaultLoginType: 'LOCAL' | 'SSO';
  allowedLoginTypes: Array<'LOCAL' | 'SSO'>;
  localLoginEnabled: boolean;
  ssoLoginEnabled: boolean;
  ssoProviderKey?: string | null;
  requireMfa: boolean;
  tokenTtlSec?: number | null;
};

export type TenantSettingImpact = {
  confidence: 'UNKNOWN' | 'ESTIMATED' | 'EXACT';
  populationCount?: number | null;
  coverage: string;
  observedAt: string;
  exclusions: string[];
};

export type TenantSettingChangeSet = {
  changeSetId: string;
  ownerType: 'AUTH_POLICY';
  ownerRef: string;
  lifecycleState:
    | 'DRAFT'
    | 'IN_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'PUBLISHED'
    | 'SUPERSEDED';
  beforeState: TenantAuthPolicyDraft;
  proposedState: TenantAuthPolicyDraft;
  beforeHash: string;
  proposedHash: string;
  impact: TenantSettingImpact;
  justification: string;
  requestedBy: number;
  submittedAt?: string | null;
  decidedBy?: number | null;
  decidedAt?: string | null;
  decisionReason?: string | null;
  publishedBy?: number | null;
  publishedAt?: string | null;
  publishReceiptId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type TenantAccessGrant = {
  entitlementType: 'ROLE' | 'APP_PRESET';
  entitlementKey: string;
  displayName: string;
  sourceType: 'DIRECT' | 'GROUP' | 'PRIVILEGED' | 'APP_PRESET' | 'APP_PRESET_GROUP';
  sourceId: string;
  sourceName?: string | null;
  scopeType: string;
  scopeRef?: string | null;
  lifecycleState: string;
  validFrom?: string | null;
  validTo?: string | null;
  privileged: boolean;
};

export type TenantAccessProjection = {
  snapshotId: string;
  observedAt: string;
  coverage: {
    state: 'COMPLETE_INTERNAL_OWNERS';
    includedOwners: string[];
    exclusions: string[];
    freshestSourceUpdatedAt?: string | null;
  };
  principals: Array<{
    userId: number;
    displayName: string;
    email?: string | null;
    status: string;
    mfaEnabled: boolean;
    grants: TenantAccessGrant[];
    pendingApprovalCount: number;
    sourceUpdatedAt: string;
  }>;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function listTenantAuthPolicyChanges(): Promise<TenantSettingChangeSet[]> {
  const response = await axiosInstance.get<ApiResponse<TenantSettingChangeSet[]>>(
    `${BASE}/auth-policy/changes`
  );
  return response.data.data;
}

export async function createTenantAuthPolicyChange(request: {
  policy: TenantAuthPolicyDraft;
  justification: string;
}): Promise<TenantSettingChangeSet> {
  const response = await axiosInstance.post<ApiResponse<TenantSettingChangeSet>, typeof request>(
    `${BASE}/auth-policy/changes`,
    request
  );
  return response.data.data;
}

async function commandTenantAuthPolicyChange(
  change: TenantSettingChangeSet,
  command: 'submit' | 'publish'
): Promise<TenantSettingChangeSet> {
  const response = await axiosInstance.post<
    ApiResponse<TenantSettingChangeSet>,
    { version: number }
  >(`${BASE}/auth-policy/changes/${change.changeSetId}/${command}`, { version: change.version });
  return response.data.data;
}

export async function submitTenantAuthPolicyChange(
  change: TenantSettingChangeSet
): Promise<TenantSettingChangeSet> {
  return commandTenantAuthPolicyChange(change, 'submit');
}

export async function publishTenantAuthPolicyChange(
  change: TenantSettingChangeSet
): Promise<TenantSettingChangeSet> {
  return commandTenantAuthPolicyChange(change, 'publish');
}

export async function decideTenantAuthPolicyChange(
  change: TenantSettingChangeSet,
  decision: 'APPROVE' | 'REJECT',
  reason: string
): Promise<TenantSettingChangeSet> {
  const body = { version: change.version, decision, reason };
  const response = await axiosInstance.post<ApiResponse<TenantSettingChangeSet>, typeof body>(
    `${BASE}/auth-policy/changes/${change.changeSetId}/decision`,
    body
  );
  return response.data.data;
}

export async function getTenantAccessProjection(
  query = '',
  page = 0,
  size = 50,
  signal?: AbortSignal
): Promise<TenantAccessProjection> {
  const search = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) search.set('query', query.trim());
  const response = await axiosInstance.get<ApiResponse<TenantAccessProjection>>(
    `${BASE}/access-projection?${search.toString()}`,
    signal ? { signal } : undefined
  );
  return response.data.data;
}
