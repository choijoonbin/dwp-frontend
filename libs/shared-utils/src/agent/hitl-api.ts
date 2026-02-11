/**
 * HITL 승인/거절 — 백엔드(Spring Boot) API 경유 전용
 * Aura API 직접 호출 제거. case_action_history 기록 및 데이터 무결성은 백엔드에서 담당.
 */

import { rejectHitlAction, approveHitlAction } from '../api/synapse-operations-api';

// ----------------------------------------------------------------------

export type HitlApprovalResponse = {
  requestId: string;
  sessionId: string;
  status: 'approved' | 'rejected';
  reason?: string;
};

export type ApproveHitlOptions = {
  userId?: string;
  /** 승인 사유 — 백엔드 Payload에 포함 (case_action_history 등 기록용) */
  comment?: string;
};

/**
 * HITL 승인 — 백엔드 POST /api/synapse/actions/hitl/{requestId}/approve
 * 사용자 입력 comment(승인 사유)를 Payload에 포함해 전송.
 */
export async function approveHitlRequest(
  requestId: string,
  options?: ApproveHitlOptions
): Promise<HitlApprovalResponse> {
  const res = await approveHitlAction(requestId, {
    comment: options?.comment,
  });
  const data = res.data as Record<string, unknown> | undefined;
  return {
    requestId,
    sessionId: (data?.sessionId as string) ?? '',
    status: 'approved',
    ...(data?.reason != null && { reason: data.reason as string }),
  };
}

/**
 * HITL 거절 — 백엔드 POST /api/synapse/actions/hitl/{requestId}/reject
 * reason(거절 사유)을 comment로 Payload에 포함.
 */
export async function rejectHitlRequest(
  requestId: string,
  reason?: string,
  _userId?: string
): Promise<HitlApprovalResponse> {
  const res = await rejectHitlAction(requestId, { comment: reason });
  const data = res.data as Record<string, unknown> | undefined;
  return {
    requestId,
    sessionId: (data?.sessionId as string) ?? '',
    status: 'rejected',
    ...(reason != null && { reason }),
  };
}

/**
 * Get HITL request details — 백엔드 GET /api/synapse/actions/hitl/{requestId} 전용 (Aura 제거)
 */
export async function getHitlRequest(requestId: string): Promise<unknown> {
  const { getHitlRequestDetail } = await import('../api/synapse-operations-api');
  const res = await getHitlRequestDetail(requestId);
  if (res.status !== 'SUCCESS' && res.status !== 'OK') {
    throw new Error(
      (res as { message?: string }).message || 'Failed to get HITL request'
    );
  }
  const data = res.data;
  return typeof data === 'string' ? JSON.parse(data) : data;
}
