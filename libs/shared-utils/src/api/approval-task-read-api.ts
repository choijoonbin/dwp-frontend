import { axiosInstance } from '../axios-instance';

import type { ApprovalTask } from './approval-management-contract';
import type { ApiResponse } from '../types';

const base = '/api/approvals/v1';

export async function getApprovalTasks(
  view = 'INBOX',
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalTask[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalTask[]>>(
    `${base}/tasks?view=${encodeURIComponent(view)}`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}
