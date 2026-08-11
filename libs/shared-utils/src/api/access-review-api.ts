import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type AccessReviewScopeType = 'TENANT' | 'ROLE' | 'GROUP';
export type AccessReviewReviewerStrategy = 'TENANT_ADMIN' | 'NAMED_REVIEWER';
export type AccessReviewLifecycle = 'DRAFT' | 'ACTIVE' | 'COMPLETED';
export type AccessReviewDecision = 'PENDING' | 'APPROVE' | 'REVOKE';
export type AccessReviewRemediationState =
  'NOT_REQUIRED' | 'PENDING' | 'APPLIED' | 'MANUAL_REQUIRED';

export type AccessReviewCampaign = {
  campaignId: string;
  name: string;
  description?: string | null;
  scopeType: AccessReviewScopeType;
  scopeRef?: number | null;
  reviewerStrategy: AccessReviewReviewerStrategy;
  reviewerUserId?: number | null;
  lifecycleState: AccessReviewLifecycle;
  dueAt: string;
  activatedAt?: string | null;
  completedAt?: string | null;
  totalItems: number;
  pendingItems: number;
  approvedItems: number;
  revokedItems: number;
  manualRemediationItems: number;
  version: number;
};

export type AccessReviewItem = {
  itemId: string;
  subjectUserId: number;
  subjectDisplayName: string;
  subjectEmail?: string | null;
  roleId: number;
  roleCode: string;
  roleName: string;
  accessSourceType: 'DIRECT' | 'GROUP';
  accessSourceId: number;
  reviewerUserId?: number | null;
  decision: AccessReviewDecision;
  decisionReason?: string | null;
  decidedBy?: number | null;
  decidedAt?: string | null;
  remediationState: AccessReviewRemediationState;
  version: number;
};

export type AccessReviewCampaignItems = {
  campaign: AccessReviewCampaign;
  items: AccessReviewItem[];
};

export type CreateAccessReviewCampaignRequest = {
  name: string;
  description?: string;
  scopeType: AccessReviewScopeType;
  scopeRef?: number;
  reviewerStrategy: AccessReviewReviewerStrategy;
  reviewerUserId?: number;
  dueAt: string;
};

const BASE = '/api/auth/admin/access/reviews';

export async function listAccessReviewCampaigns(): Promise<AccessReviewCampaign[]> {
  const response = await axiosInstance.get<ApiResponse<AccessReviewCampaign[]>>(BASE);
  return response.data.data;
}

export async function getAccessReviewCampaign(
  campaignId: string
): Promise<AccessReviewCampaignItems> {
  const response = await axiosInstance.get<ApiResponse<AccessReviewCampaignItems>>(
    `${BASE}/${campaignId}`
  );
  return response.data.data;
}

export async function createAccessReviewCampaign(
  request: CreateAccessReviewCampaignRequest
): Promise<AccessReviewCampaign> {
  const response = await axiosInstance.post<
    ApiResponse<AccessReviewCampaign>,
    CreateAccessReviewCampaignRequest
  >(BASE, request);
  return response.data.data;
}

export async function activateAccessReviewCampaign(
  campaign: AccessReviewCampaign
): Promise<AccessReviewCampaign> {
  const response = await axiosInstance.post<ApiResponse<AccessReviewCampaign>, { version: number }>(
    `${BASE}/${campaign.campaignId}/activate`,
    { version: campaign.version }
  );
  return response.data.data;
}

export async function decideAccessReviewItem(
  campaignId: string,
  item: AccessReviewItem,
  decision: Exclude<AccessReviewDecision, 'PENDING'>,
  reason: string
): Promise<AccessReviewItem> {
  const response = await axiosInstance.put<
    ApiResponse<AccessReviewItem>,
    { decision: Exclude<AccessReviewDecision, 'PENDING'>; reason: string; version: number }
  >(`${BASE}/${campaignId}/items/${item.itemId}/decision`, {
    decision,
    reason,
    version: item.version,
  });
  return response.data.data;
}

export async function completeAccessReviewCampaign(
  campaign: AccessReviewCampaign
): Promise<AccessReviewCampaign> {
  const response = await axiosInstance.post<ApiResponse<AccessReviewCampaign>, { version: number }>(
    `${BASE}/${campaign.campaignId}/complete`,
    { version: campaign.version }
  );
  return response.data.data;
}
