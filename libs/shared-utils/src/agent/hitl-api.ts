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
    throw new Error(`HITL approval failed: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
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
    throw new Error(`HITL rejection failed: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
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
    throw new Error(`Failed to get HITL request: ${response.status}`);
  }

  const result = await response.json();
  // Backend returns data as JSON string, parse it
  return typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
}
