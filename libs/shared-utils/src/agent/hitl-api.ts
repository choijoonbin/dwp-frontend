// ----------------------------------------------------------------------

import { NX_API_URL } from '../env';
import { getTenantId } from '../tenant-util';
import { getUserId } from '../auth/user-id-storage';
import { getAccessToken } from '../auth/token-storage';

// ----------------------------------------------------------------------

export type HitlApprovalResponse = {
  requestId: string;
  sessionId: string;
  status: 'approved' | 'rejected';
  reason?: string;
};

/**
 * Approve a HITL request
 */
export async function approveHitlRequest(
  requestId: string,
  userId?: string
): Promise<HitlApprovalResponse> {
  const token = getAccessToken();
  const tenantId = getTenantId();
  const finalUserId = userId || getUserId();

  if (!finalUserId) {
    throw new Error('User ID is required for HITL approval');
  }

  const response = await fetch(`${NX_API_URL}/api/aura/hitl/approve/${requestId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId,
      'X-User-ID': finalUserId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: finalUserId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HITL approval failed: ${response.status}`);
  }

  const result = await response.json();
  
  // Backend returns ApiResponse<HitlApprovalResponse>
  if (result.status === 'SUCCESS' || result.success) {
    return result.data;
  }
  
  throw new Error(result.message || 'HITL approval failed');
}

/**
 * Reject a HITL request
 */
export async function rejectHitlRequest(
  requestId: string,
  reason?: string,
  userId?: string
): Promise<HitlApprovalResponse> {
  const token = getAccessToken();
  const tenantId = getTenantId();
  const finalUserId = userId || getUserId();

  if (!finalUserId) {
    throw new Error('User ID is required for HITL rejection');
  }

  const response = await fetch(`${NX_API_URL}/api/aura/hitl/reject/${requestId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId,
      'X-User-ID': finalUserId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: finalUserId,
      ...(reason && { reason }),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HITL rejection failed: ${response.status}`);
  }

  const result = await response.json();
  
  // Backend returns ApiResponse<HitlApprovalResponse>
  if (result.status === 'SUCCESS' || result.success) {
    return result.data;
  }
  
  throw new Error(result.message || 'HITL rejection failed');
}

/**
 * Get HITL request details
 */
export async function getHitlRequest(requestId: string): Promise<any> {
  const token = getAccessToken();
  const tenantId = getTenantId();

  const response = await fetch(`${NX_API_URL}/api/aura/hitl/requests/${requestId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to get HITL request: ${response.status}`);
  }

  const result = await response.json();
  
  // Backend returns ApiResponse with data as JSON string, parse it
  if (result.status === 'SUCCESS' || result.success) {
    return typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
  }
  
  throw new Error(result.message || 'Failed to get HITL request');
}
