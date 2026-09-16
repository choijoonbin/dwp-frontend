import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type AccessReviewWorkDecision = 'PENDING' | 'APPROVE' | 'REVOKE';
export type AccessReviewWorkRemediationState =
  'NOT_REQUIRED' | 'PENDING' | 'APPLIED' | 'MANUAL_REQUIRED';

export const ACCESS_REVIEW_REASON_MIN_LENGTH = 10;
export const ACCESS_REVIEW_REASON_MAX_LENGTH = 500;

export type AccessReviewWorkDetail = {
  workItemRef: string;
  campaignName: string;
  dueAt: string;
  subjectUserId: number;
  subjectDisplayName: string;
  subjectEmail?: string | null;
  subjectOrganizationName?: string | null;
  subjectWorkerNumber?: string | null;
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

export type AccessReviewDecisionReceiptSource = Pick<
  AccessReviewWorkDetail,
  | 'workItemRef'
  | 'subjectUserId'
  | 'roleId'
  | 'accessSourceType'
  | 'sourceKey'
  | 'decision'
  | 'version'
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDecisionRequest(request: DecideAccessReviewWorkRequest): boolean {
  if (typeof request.reason !== 'string') return false;
  const reason = request.reason.trim();
  return (
    (request.decision === 'APPROVE' || request.decision === 'REVOKE') &&
    reason.length >= ACCESS_REVIEW_REASON_MIN_LENGTH &&
    request.reason.length <= ACCESS_REVIEW_REASON_MAX_LENGTH &&
    Number.isSafeInteger(request.version) &&
    request.version >= 0 &&
    request.version < Number.MAX_SAFE_INTEGER
  );
}

export function isAccessReviewDecisionSource(
  value: unknown
): value is AccessReviewDecisionReceiptSource {
  if (!isRecord(value)) return false;
  const sourceKey = value.sourceKey ?? null;
  return (
    typeof value.workItemRef === 'string' &&
    value.workItemRef.trim().length > 0 &&
    Number.isSafeInteger(value.subjectUserId) &&
    (value.subjectUserId as number) > 0 &&
    Number.isSafeInteger(value.roleId) &&
    (value.roleId as number) > 0 &&
    (value.accessSourceType === 'DIRECT' || value.accessSourceType === 'GROUP') &&
    (sourceKey === null || (typeof sourceKey === 'string' && sourceKey.trim().length > 0)) &&
    (value.accessSourceType !== 'GROUP' || sourceKey !== null) &&
    value.decision === 'PENDING' &&
    Number.isSafeInteger(value.version) &&
    (value.version as number) >= 0 &&
    (value.version as number) < Number.MAX_SAFE_INTEGER
  );
}

/**
 * A 2xx transport response is not evidence of success on its own. The owner receipt must
 * describe the exact reviewed assignment and the exact decision that was submitted.
 */
export function isExactAccessReviewDecisionReceipt(
  receipt: unknown,
  reviewed: AccessReviewDecisionReceiptSource,
  submitted: DecideAccessReviewWorkRequest
): receipt is AccessReviewWorkDetail {
  if (
    !isRecord(receipt) ||
    !isAccessReviewDecisionSource(reviewed) ||
    !isValidDecisionRequest(submitted) ||
    submitted.version !== reviewed.version
  ) {
    return false;
  }
  const expectedReason = submitted.reason.trim();
  const expectedRemediationState: AccessReviewWorkRemediationState =
    submitted.decision === 'APPROVE'
      ? 'NOT_REQUIRED'
      : reviewed.accessSourceType === 'DIRECT'
        ? 'PENDING'
        : 'MANUAL_REQUIRED';
  return (
    receipt.workItemRef === reviewed.workItemRef &&
    receipt.subjectUserId === reviewed.subjectUserId &&
    receipt.roleId === reviewed.roleId &&
    receipt.accessSourceType === reviewed.accessSourceType &&
    (receipt.sourceKey ?? null) === (reviewed.sourceKey ?? null) &&
    receipt.decision === submitted.decision &&
    receipt.decisionReason === expectedReason &&
    receipt.version === reviewed.version + 1 &&
    receipt.remediationState === expectedRemediationState &&
    typeof receipt.decidedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      receipt.decidedAt
    ) &&
    Number.isFinite(Date.parse(receipt.decidedAt))
  );
}

export const ACCESS_REVIEW_WORK_ENDPOINT = '/api/auth/work/access-review-items' as const;

export async function getAccessReviewWorkDetail(
  workItemRef: string,
  signal?: AbortSignal
): Promise<AccessReviewWorkDetail> {
  const response = await axiosInstance.get<ApiResponse<AccessReviewWorkDetail>>(
    `${ACCESS_REVIEW_WORK_ENDPOINT}/${encodeURIComponent(workItemRef)}`,
    { timeoutMs: 8_000, signal }
  );
  return response.data.data;
}

export async function decideAccessReviewWork(
  workItemRef: string,
  request: DecideAccessReviewWorkRequest,
  signal?: AbortSignal
): Promise<AccessReviewWorkDetail> {
  if (!isValidDecisionRequest(request)) {
    throw new TypeError('Access review decision request is invalid');
  }
  const response = await axiosInstance.put<
    ApiResponse<AccessReviewWorkDetail>,
    DecideAccessReviewWorkRequest
  >(`${ACCESS_REVIEW_WORK_ENDPOINT}/${encodeURIComponent(workItemRef)}/decision`, request, {
    timeoutMs: 8_000,
    signal,
  });
  return response.data.data;
}
