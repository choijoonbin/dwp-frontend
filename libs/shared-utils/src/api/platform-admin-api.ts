import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type ReferenceLifecycle = 'DRAFT' | 'ACTIVE' | 'RETIRED';

export type ReferenceSetSummary = {
  setKey: string;
  name: string;
  description?: string | null;
  lifecycleState: ReferenceLifecycle;
  itemCount: number;
  revision: number;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type ReferenceLabel = {
  locale: string;
  label: string;
  description?: string | null;
};

export type ReferenceItem = {
  code: string;
  lifecycleState: ReferenceLifecycle;
  sortOrder: number;
  parentCode?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  labels: ReferenceLabel[];
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type ReferenceSetDetail = Omit<ReferenceSetSummary, 'itemCount'> & {
  items: ReferenceItem[];
};

export type PageResult<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type CreateReferenceSetRequest = {
  setKey: string;
  name: string;
  description?: string;
};

export type UpdateReferenceSetRequest = {
  name: string;
  description?: string;
  version: number;
};

export type CreateReferenceItemRequest = {
  code: string;
  sortOrder: number;
  parentCode?: string;
  validFrom?: string;
  validTo?: string;
  labels: ReferenceLabel[];
};

export type UpdateReferenceItemRequest = Omit<CreateReferenceItemRequest, 'code'> & {
  version: number;
};

export type PlatformAuditEvent = {
  auditEventId: string;
  actorType: 'USER' | 'SERVICE';
  actorId?: number | null;
  action: string;
  targetType: string;
  targetId: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  correlationId?: string | null;
  occurredAt: string;
};

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

export async function listReferenceSets(query = ''): Promise<PageResult<ReferenceSetSummary>> {
  const search = new URLSearchParams({ page: '0', size: '100' });
  if (query.trim()) search.set('query', query.trim());
  const response = await axiosInstance.get<ApiResponse<PageResult<ReferenceSetSummary>>>(
    '/api/platform/v1/admin/reference-sets?' + search.toString()
  );
  return response.data.data;
}

export async function getReferenceSet(setKey: string): Promise<ReferenceSetDetail> {
  const response = await axiosInstance.get<ApiResponse<ReferenceSetDetail>>(
    '/api/platform/v1/admin/reference-sets/' + encodePath(setKey)
  );
  return response.data.data;
}

export async function createReferenceSet(
  request: CreateReferenceSetRequest
): Promise<ReferenceSetDetail> {
  const response = await axiosInstance.post<
    ApiResponse<ReferenceSetDetail>,
    CreateReferenceSetRequest
  >('/api/platform/v1/admin/reference-sets', request);
  return response.data.data;
}

export async function updateReferenceSet(
  setKey: string,
  request: UpdateReferenceSetRequest
): Promise<ReferenceSetDetail> {
  const response = await axiosInstance.patch<
    ApiResponse<ReferenceSetDetail>,
    UpdateReferenceSetRequest
  >('/api/platform/v1/admin/reference-sets/' + encodePath(setKey), request);
  return response.data.data;
}

export async function activateReferenceSet(
  setKey: string,
  version: number
): Promise<ReferenceSetDetail> {
  const response = await axiosInstance.post<ApiResponse<ReferenceSetDetail>, { version: number }>(
    '/api/platform/v1/admin/reference-sets/' + encodePath(setKey) + '/activate',
    { version }
  );
  return response.data.data;
}

export async function retireReferenceSet(
  setKey: string,
  version: number
): Promise<ReferenceSetDetail> {
  const response = await axiosInstance.post<ApiResponse<ReferenceSetDetail>, { version: number }>(
    '/api/platform/v1/admin/reference-sets/' + encodePath(setKey) + '/retire',
    { version }
  );
  return response.data.data;
}

export async function createReferenceItem(
  setKey: string,
  request: CreateReferenceItemRequest
): Promise<ReferenceSetDetail> {
  const response = await axiosInstance.post<
    ApiResponse<ReferenceSetDetail>,
    CreateReferenceItemRequest
  >('/api/platform/v1/admin/reference-sets/' + encodePath(setKey) + '/items', request);
  return response.data.data;
}

export async function updateReferenceItem(
  setKey: string,
  code: string,
  request: UpdateReferenceItemRequest
): Promise<ReferenceSetDetail> {
  const response = await axiosInstance.patch<
    ApiResponse<ReferenceSetDetail>,
    UpdateReferenceItemRequest
  >(
    '/api/platform/v1/admin/reference-sets/' + encodePath(setKey) + '/items/' + encodePath(code),
    request
  );
  return response.data.data;
}

export async function activateReferenceItem(
  setKey: string,
  code: string,
  version: number
): Promise<ReferenceSetDetail> {
  const response = await axiosInstance.post<ApiResponse<ReferenceSetDetail>, { version: number }>(
    '/api/platform/v1/admin/reference-sets/' +
      encodePath(setKey) +
      '/items/' +
      encodePath(code) +
      '/activate',
    { version }
  );
  return response.data.data;
}

export async function retireReferenceItem(
  setKey: string,
  code: string,
  version: number
): Promise<ReferenceSetDetail> {
  const response = await axiosInstance.post<ApiResponse<ReferenceSetDetail>, { version: number }>(
    '/api/platform/v1/admin/reference-sets/' +
      encodePath(setKey) +
      '/items/' +
      encodePath(code) +
      '/retire',
    { version }
  );
  return response.data.data;
}

export async function listPlatformAuditEvents(): Promise<PageResult<PlatformAuditEvent>> {
  const response = await axiosInstance.get<ApiResponse<PageResult<PlatformAuditEvent>>>(
    '/api/platform/v1/admin/audit-events?page=0&size=100'
  );
  return response.data.data;
}
