import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type ServiceCatalogLifecycle = 'DRAFT' | 'ACTIVE' | 'RETIRED';
export type ServiceRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'AWAITING_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';
export type ServiceRequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ServiceDataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type ServiceFieldType = 'TEXT' | 'TEXTAREA' | 'SELECT' | 'DATE' | 'NUMBER' | 'CHECKBOX';

export type ServiceRequestField = {
  key: string;
  type: ServiceFieldType;
  labelKo: string;
  labelEn: string;
  required?: boolean;
  options?: string[];
};

export type ServiceRequestSchema = { fields: ServiceRequestField[] };

export type ServiceCategory = {
  categoryKey: string;
  name: string;
  description: string;
  iconKey: string;
  tone: string;
  sortOrder: number;
};

export type ServiceCatalogItem = {
  serviceKey: string;
  categoryKey: string;
  name: string;
  description: string;
  ownerGroup: string;
  lifecycleState: ServiceCatalogLifecycle;
  requestSchema: ServiceRequestSchema;
  schemaVersion: number;
  slaHours: number;
  estimatedResolutionHours: number;
  dataClassification: ServiceDataClassification;
  featured: boolean;
  tags: string[];
  version: number;
};

export type AdminServiceCatalogItem = Omit<ServiceCatalogItem, 'name' | 'description'> & {
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
};

export type ServiceCatalog = {
  categories: ServiceCategory[];
  items: ServiceCatalogItem[];
  activeCount: number;
  generatedAt: string;
};

export type ServiceRequestSummary = {
  requestId: string;
  requestNumber: string;
  serviceKey: string;
  serviceNameKo: string;
  serviceNameEn: string;
  summary: string;
  dataClassification?: ServiceDataClassification | null;
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  assignedGroup: string;
  assignedTo?: string | null;
  submittedAt?: string | null;
  slaDueAt?: string | null;
  updatedAt: string;
  version: number;
};

export type ServiceTimelineEvent = {
  eventId: string;
  eventType: string;
  status: ServiceRequestStatus;
  actorType: 'USER' | 'AGENT' | 'SYSTEM';
  actorId?: number | null;
  note?: string | null;
  occurredAt: string;
};

export type ServiceRequestDetail = {
  request: ServiceRequestSummary;
  values: Record<string, unknown>;
  requestSchema: ServiceRequestSchema;
  schemaVersion: number;
  dataClassification: ServiceDataClassification;
  timeline: ServiceTimelineEvent[];
};

export async function getServiceCatalog(): Promise<ServiceCatalog> {
  const response = await axiosInstance.get<ApiResponse<ServiceCatalog>>(
    '/api/platform/v1/services/catalog'
  );
  return response.data.data;
}

export async function getMyServiceRequests(
  status?: ServiceRequestStatus
): Promise<ServiceRequestSummary[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await axiosInstance.get<ApiResponse<ServiceRequestSummary[]>>(
    `/api/platform/v1/services/requests${suffix}`
  );
  return response.data.data;
}

export async function getMyServiceRequest(requestId: string): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.get<ApiResponse<ServiceRequestDetail>>(
    `/api/platform/v1/services/requests/${requestId}`
  );
  return response.data.data;
}

export async function createServiceRequest(input: {
  serviceKey: string;
  summary: string;
  values: Record<string, unknown>;
  idempotencyKey: string;
  submit: boolean;
}): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.post<ApiResponse<ServiceRequestDetail>, typeof input>(
    '/api/platform/v1/services/requests',
    input
  );
  return response.data.data;
}

export async function updateServiceDraft(
  requestId: string,
  input: { summary: string; values: Record<string, unknown>; version: number; submit?: boolean }
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.put<ApiResponse<ServiceRequestDetail>, typeof input>(
    `/api/platform/v1/services/requests/${requestId}/draft`,
    input
  );
  return response.data.data;
}

export async function submitServiceDraft(
  requestId: string,
  version: number
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.post<ApiResponse<ServiceRequestDetail>, { version: number }>(
    `/api/platform/v1/services/requests/${requestId}/submit`,
    { version }
  );
  return response.data.data;
}

export async function cancelServiceRequest(
  requestId: string,
  version: number
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.post<ApiResponse<ServiceRequestDetail>, { version: number }>(
    `/api/platform/v1/services/requests/${requestId}/cancel`,
    { version }
  );
  return response.data.data;
}

export async function getAdminServiceCatalog(): Promise<AdminServiceCatalogItem[]> {
  const response = await axiosInstance.get<ApiResponse<AdminServiceCatalogItem[]>>(
    '/api/platform/v1/admin/services/catalog'
  );
  return response.data.data;
}

export async function saveAdminServiceCatalogItem(input: {
  serviceKey: string;
  categoryKey: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  ownerGroup: string;
  lifecycleState: ServiceCatalogLifecycle;
  requestSchema: ServiceRequestSchema;
  slaHours: number;
  estimatedResolutionHours: number;
  dataClassification: ServiceDataClassification;
  featured: boolean;
  tags: string[];
  version?: number | null;
}): Promise<AdminServiceCatalogItem> {
  if (input.version == null) {
    const response = await axiosInstance.post<ApiResponse<AdminServiceCatalogItem>, typeof input>(
      '/api/platform/v1/admin/services/catalog',
      input
    );
    return response.data.data;
  }
  const response = await axiosInstance.put<ApiResponse<AdminServiceCatalogItem>, typeof input>(
    `/api/platform/v1/admin/services/catalog/${encodeURIComponent(input.serviceKey)}`,
    input
  );
  return response.data.data;
}

export async function getServiceOperationsQueue(
  status?: ServiceRequestStatus
): Promise<ServiceRequestSummary[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await axiosInstance.get<ApiResponse<ServiceRequestSummary[]>>(
    `/api/platform/v1/admin/services/requests${suffix}`
  );
  return response.data.data;
}

export async function getServiceOperationsRequest(
  requestId: string
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.get<ApiResponse<ServiceRequestDetail>>(
    `/api/platform/v1/admin/services/requests/${requestId}`
  );
  return response.data.data;
}

export async function transitionServiceRequest(
  requestId: string,
  input: {
    targetStatus: ServiceRequestStatus;
    note?: string | null;
    assignedTo?: string | null;
    version: number;
  }
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.post<ApiResponse<ServiceRequestDetail>, typeof input>(
    `/api/platform/v1/admin/services/requests/${requestId}/transition`,
    input
  );
  return response.data.data;
}
