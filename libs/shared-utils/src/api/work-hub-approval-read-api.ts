import { axiosInstance } from '../axios-instance';
import { readApprovalInformationRound } from './approval-information-contract';
import { assertSupportedApprovalFormSchema } from './approval-management-contract';
import { readApprovalQuorumTaskSnapshot } from './approval-quorum-contract';

import type { ApiResponse } from '../types';
import type { ApprovalRequestDetail, ApprovalTaskDetail } from './approval-api-contracts';
import type { ApprovalRequest } from './approval-request-contract';

const base = '/api/approvals/v1';

/** Narrow read projection used by Workspace without importing Approval mutation contracts. */
export async function getWorkHubApprovalRequests(
  view = 'SUBMITTED',
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalRequest[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequest[]>>(
    `${base}/requests?view=${encodeURIComponent(view)}`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}

export async function getWorkHubApprovalTask(
  taskId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalTaskDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalTaskDetail>>(
    `${base}/tasks/${taskId}`,
    { contextScopeKey, signal }
  );
  if (response.data.data.formSchema)
    assertSupportedApprovalFormSchema(response.data.data.formSchema);
  if (response.data.data.quorum != null) {
    return {
      ...response.data.data,
      quorum: readApprovalQuorumTaskSnapshot(response.data.data.quorum),
    };
  }
  return response.data.data;
}

export async function getWorkHubApprovalRequestDetail(
  requestId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalRequestDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequestDetail>>(
    `${base}/requests/${requestId}/detail`,
    { contextScopeKey, signal }
  );
  const data = response.data.data;
  const round = readApprovalInformationRound(data.informationRound);
  if (
    (data.informationGeneration != null &&
      (!Number.isSafeInteger(data.informationGeneration) || data.informationGeneration < 1)) ||
    (round &&
      (data.informationGeneration !== round.sourceGeneration ||
        data.request.status !== 'NEEDS_INFO' ||
        (data.formSchemaSha256 != null &&
          data.formSchemaSha256 !== round.pins.formSchemaSha256))) ||
    (data.informationGeneration != null && data.request.status === 'NEEDS_INFO' && !round)
  ) {
    throw new Error('Invalid approval information source');
  }
  if (data.formSchema) assertSupportedApprovalFormSchema(data.formSchema);
  return round ? { ...data, informationRound: round } : data;
}
