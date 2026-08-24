import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type AccessReviewWorkDecision = 'PENDING' | 'APPROVE' | 'REVOKE';
export type AccessReviewWorkRemediationState =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPLIED'
  | 'MANUAL_REQUIRED';

export type AccessReviewWorkDetail = {
  workItemRef: string;
  campaignName: string;
  dueAt: string;
  subjectUserId: number;
  subjectDisplayName: string;
  subjectEmail?: string | null;
  roleId: number;
  roleCode: string;
  roleName: string;
  accessSourceType: 'DIRECT' | 'GROUP';
  sourceKey?: string | null;
  sourceDisplayName?: string | null;
  assignmentCreatedAt?: string | null;
  subjectLastSignInAt?: string | null;
  privileged: boolean;
  recommendation: 'KEEP' | 'REVIEW' | 'UNAVAILABLE';
  recommendationReason:
    | 'RECENT_ACTIVITY'
    | 'PRIVILEGED_ROLE'
    | 'NEVER_SIGNED_IN'
    | 'INACTIVE_90_DAYS'
    | 'EVIDENCE_UNAVAILABLE';
  decision: AccessReviewWorkDecision;
  decisionReason?: string | null;
  decidedAt?: string | null;
  remediationState: AccessReviewWorkRemediationState;
  version: number;
};

export type DecideAccessReviewWorkRequest = {
  decision: Exclude<AccessReviewWorkDecision, 'PENDING'>;
  reason: string;
  version: number;
};

export const ACCESS_REVIEW_WORK_ENDPOINT = '/api/auth/work/access-review-items' as const;

export async function getAccessReviewWorkDetail(
  workItemRef: string
): Promise<AccessReviewWorkDetail> {
  const response = await axiosInstance.get<ApiResponse<AccessReviewWorkDetail>>(
    `${ACCESS_REVIEW_WORK_ENDPOINT}/${encodeURIComponent(workItemRef)}`,
    { timeoutMs: 8_000 }
  );
  return response.data.data;
}

export async function decideAccessReviewWork(
  workItemRef: string,
  request: DecideAccessReviewWorkRequest
): Promise<AccessReviewWorkDetail> {
  const response = await axiosInstance.put<
    ApiResponse<AccessReviewWorkDetail>,
    DecideAccessReviewWorkRequest
  >(`${ACCESS_REVIEW_WORK_ENDPOINT}/${encodeURIComponent(workItemRef)}/decision`, request, {
    timeoutMs: 8_000,
  });
  return response.data.data;
}
