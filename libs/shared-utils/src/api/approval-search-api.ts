import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { ApprovalRequest } from './approval-request-contract';
import type { ApprovalPriority, ApprovalTask } from './approval-management-contract';

export type ApprovalPage<T> = {
  items: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  hasNext: boolean;
  evaluatedAt: string;
};

export type ApprovalRequestSearchView =
  'SUBMITTED' | 'DRAFTS' | 'DELETED' | 'ARCHIVE' | 'NEEDS_INFO';
export type ApprovalSearchFilters = {
  query?: string;
  status?: string;
  priority?: ApprovalPriority;
  workflowId?: string;
  due?: 'ALL' | 'OVERDUE' | 'TODAY';
  page?: number;
  size?: number;
  sort?: 'PRIORITY' | 'NEWEST' | 'OLDEST';
  minRiskScore?: number;
};

function searchParams(view: string, filters: ApprovalSearchFilters) {
  const params = new URLSearchParams({ view });
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export async function searchApprovalRequests(
  view: ApprovalRequestSearchView,
  filters: ApprovalSearchFilters = {},
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalPage<ApprovalRequest>> {
  const response = await axiosInstance.get<ApiResponse<ApprovalPage<ApprovalRequest>>>(
    `/api/approvals/v1/requests/search?${searchParams(view, filters)}`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}

export async function searchApprovalTasks(
  view: 'INBOX' | 'DELEGATED' | 'COMPLETED',
  filters: ApprovalSearchFilters = {},
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalPage<ApprovalTask>> {
  const response = await axiosInstance.get<ApiResponse<ApprovalPage<ApprovalTask>>>(
    `/api/approvals/v1/tasks/search?${searchParams(view, filters)}`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}
