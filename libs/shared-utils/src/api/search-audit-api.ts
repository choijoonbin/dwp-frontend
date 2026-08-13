import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type GlobalSearchAuditSource =
  | 'APPS'
  | 'WORK'
  | 'PEOPLE'
  | 'ORGANIZATIONS'
  | 'TENANT_AUDIT'
  | 'TENANT_CATALOG'
  | 'PROVIDER_TENANTS'
  | 'PROVIDER_AUDIT'
  | 'PROVIDER_CATALOG';

export type GlobalSearchAuditRequest = {
  phase: 'QUERY' | 'SELECTION';
  query: string;
  sources: GlobalSearchAuditSource[];
  resultCount: number;
  selectedKind?: string;
  selectedId?: string;
};

export type GlobalSearchAuditReceipt = {
  eventId: string;
  queryDigest: string;
};

export async function recordGlobalSearchAudit(
  request: GlobalSearchAuditRequest
): Promise<GlobalSearchAuditReceipt> {
  const response = await axiosInstance.post<
    ApiResponse<GlobalSearchAuditReceipt>,
    GlobalSearchAuditRequest
  >('/api/platform/v1/search/audit', request);
  return response.data.data;
}
