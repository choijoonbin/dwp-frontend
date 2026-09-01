import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  ProviderAuditEvent,
  ProviderSupportAccessRequest,
  ProviderSupportPostReviewEvidence,
  ProviderSupportScope,
  ProviderSupportSession,
  ProviderSupportSessionContext,
} from './provider-control-contracts';

const BASE = '/api/provider/v1/admin';

export async function listProviderSupportSessions(
  tenantId?: string
): Promise<ProviderSupportSession[]> {
  const search = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const response = await axiosInstance.get<ApiResponse<ProviderSupportSession[]>>(
    `${BASE}/support-sessions${search}`
  );
  return response.data.data;
}

export async function listProviderSupportScopes(): Promise<ProviderSupportScope[]> {
  const response = await axiosInstance.get<ApiResponse<ProviderSupportScope[]>>(
    `${BASE}/support-scopes`
  );
  return response.data.data;
}

export async function listProviderSupportAccessRequests(
  tenantId?: string
): Promise<ProviderSupportAccessRequest[]> {
  const search = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const response = await axiosInstance.get<ApiResponse<ProviderSupportAccessRequest[]>>(
    `${BASE}/support-access-requests${search}`
  );
  return response.data.data;
}

export async function createProviderSupportAccessRequest(request: {
  tenantId: string;
  scopes: string[];
  durationMinutes: number;
  justification: string;
  approvalReference?: string | null;
  requestKey: string;
}): Promise<ProviderSupportAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSupportAccessRequest>,
    typeof request
  >(`${BASE}/support-access-requests`, request);
  return response.data.data;
}

export async function decideProviderSupportAccessRequest(
  request: Pick<ProviderSupportAccessRequest, 'supportAccessRequestId' | 'version'>,
  decision: 'APPROVED' | 'DENIED',
  reason: string
): Promise<ProviderSupportAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSupportAccessRequest>,
    { decision: 'APPROVED' | 'DENIED'; reason: string; version: number }
  >(`${BASE}/support-access-requests/${request.supportAccessRequestId}/decision`, {
    decision,
    reason,
    version: request.version,
  });
  return response.data.data;
}

export async function activateProviderSupportAccessRequest(
  request: Pick<ProviderSupportAccessRequest, 'supportAccessRequestId' | 'version'>
): Promise<ProviderSupportAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSupportAccessRequest>,
    { version: number }
  >(`${BASE}/support-access-requests/${request.supportAccessRequestId}/activate`, {
    version: request.version,
  });
  return response.data.data;
}

export async function cancelProviderSupportAccessRequest(
  request: Pick<ProviderSupportAccessRequest, 'supportAccessRequestId' | 'version'>,
  reason: string
): Promise<ProviderSupportAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSupportAccessRequest>,
    { reason: string; version: number }
  >(`${BASE}/support-access-requests/${request.supportAccessRequestId}/cancel`, {
    reason,
    version: request.version,
  });
  return response.data.data;
}

export async function reviewProviderSupportAccessRequest(
  request: Pick<ProviderSupportAccessRequest, 'supportAccessRequestId' | 'version'>,
  summary: string
): Promise<ProviderSupportAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSupportAccessRequest>,
    { summary: string; version: number }
  >(`${BASE}/support-access-requests/${request.supportAccessRequestId}/review`, {
    summary,
    version: request.version,
  });
  return response.data.data;
}

export async function getProviderSupportSessionContext(): Promise<ProviderSupportSessionContext | null> {
  const response = await axiosInstance.get<ApiResponse<ProviderSupportSessionContext | null>>(
    `${BASE}/support-session-context`
  );
  return response.data.data ?? null;
}

export async function revokeProviderSupportSession(
  session: Pick<ProviderSupportSession, 'supportSessionId' | 'version'>,
  justification: string
): Promise<ProviderSupportSession> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSupportSession>,
    { justification: string; version: number }
  >(`${BASE}/support-sessions/${session.supportSessionId}/revoke`, {
    justification,
    version: session.version,
  });
  return response.data.data;
}

export async function listProviderAuditEvents(tenantId?: string): Promise<ProviderAuditEvent[]> {
  const search = new URLSearchParams({ limit: '300' });
  if (tenantId) search.set('tenantId', tenantId);
  const response = await axiosInstance.get<ApiResponse<ProviderAuditEvent[]>>(
    `${BASE}/audit-events?${search.toString()}`
  );
  return response.data.data;
}

export async function getProviderSupportPostReviewEvidence(
  supportAccessRequestId: string
): Promise<ProviderSupportPostReviewEvidence> {
  const response = await axiosInstance.get<ApiResponse<ProviderSupportPostReviewEvidence>>(
    `${BASE}/support-access-requests/${encodeURIComponent(supportAccessRequestId)}/post-review-evidence`
  );
  return response.data.data;
}
