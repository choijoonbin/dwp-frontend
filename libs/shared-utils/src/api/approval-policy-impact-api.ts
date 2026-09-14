import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  readApprovalPolicyImpact,
  validateApprovalPolicyImpactReadAuthority,
} from './approval-policy-impact-contract';
import type { ApprovalPolicyImpactReadAuthority } from './approval-policy-impact-contract';

export async function getApprovalPolicyImpact(
  policyId: string,
  expectedVersion: number,
  authority: ApprovalPolicyImpactReadAuthority,
  options?: { signal?: AbortSignal; beforeDispatch?: () => void; now?: () => number }
) {
  validateApprovalPolicyImpactReadAuthority(authority);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(policyId) ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    throw new Error('Invalid approval policy impact contract');
  }
  const original = Object.freeze({
    policyId,
    expectedVersion,
    authority: Object.freeze({ ...authority }),
  });
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/approvals/v1/admin/policies/${policyId}/impact?expectedVersion=${expectedVersion}`,
    {
      headers: { 'X-DWP-Expected-Decision-Revision': original.authority.expectedDecisionRevision },
      contextScopeKey: original.authority.contextScopeKey,
      beforeDispatch: options?.beforeDispatch,
      signal: options?.signal,
      timeoutMs: 10000,
    }
  );
  options?.beforeDispatch?.();
  return readApprovalPolicyImpact(response.data.data, original, options?.now?.() ?? Date.now());
}
