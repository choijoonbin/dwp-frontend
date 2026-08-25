import { axiosInstance } from '../axios-instance';
import { productSurfaceGovernedMutationConfig } from './product-surface-governed-mutation';

import type { ApiResponse } from '../types';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

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

export const SERVICES_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createServiceRequest',
    routeContractKey: 'route.services.work.request-create.action',
    method: 'POST',
    path: '/api/platform/v1/services/requests',
  },
  {
    apiFunction: 'updateServiceDraft',
    routeContractKey: 'route.services.work.draft-update.action',
    method: 'PUT',
    path: '/api/platform/v1/services/requests/{requestId}/draft',
  },
  {
    apiFunction: 'submitServiceDraft',
    routeContractKey: 'route.services.work.draft-submit.action',
    method: 'POST',
    path: '/api/platform/v1/services/requests/{requestId}/submit',
  },
  {
    apiFunction: 'cancelServiceRequest',
    routeContractKey: 'route.services.work.request-cancel.action',
    method: 'POST',
    path: '/api/platform/v1/services/requests/{requestId}/cancel',
  },
  {
    apiFunction: 'saveAdminServiceCatalogItem:create',
    routeContractKey: 'route.services.management.catalog-create.action',
    method: 'POST',
    path: '/api/platform/v1/admin/services/catalog',
  },
  {
    apiFunction: 'saveAdminServiceCatalogItem:update',
    routeContractKey: 'route.services.management.catalog-update.action',
    method: 'PUT',
    path: '/api/platform/v1/admin/services/catalog/{serviceKey}',
  },
  {
    apiFunction: 'transitionServiceRequest',
    routeContractKey: 'route.services.management.request-transition.action',
    method: 'POST',
    path: '/api/platform/v1/admin/services/requests/{requestId}/transition',
  },
] as const;

function selectedScope(contextScopeKey?: string, signal?: AbortSignal) {
  if (contextScopeKey === undefined && signal === undefined) return undefined;
  return {
    ...(contextScopeKey === undefined ? {} : { contextScopeKey }),
    ...(signal === undefined ? {} : { signal }),
  };
}

async function readServiceCatalog(
  path: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ServiceCatalog> {
  const response = await axiosInstance.get<ApiResponse<ServiceCatalog>>(
    path,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

async function readServiceRequests(
  path: string,
  signal?: AbortSignal
): Promise<ServiceRequestSummary[]> {
  const response = await axiosInstance.get<ApiResponse<ServiceRequestSummary[]>>(
    path,
    selectedScope(undefined, signal)
  );
  return response.data.data;
}

async function readServiceRequest(
  requestId: string,
  query: '' | '?view=draft',
  signal?: AbortSignal
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.get<ApiResponse<ServiceRequestDetail>>(
    `/api/platform/v1/services/requests/${requestId}${query}`,
    selectedScope(undefined, signal)
  );
  return response.data.data;
}

export async function getServiceCatalog(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ServiceCatalog> {
  return readServiceCatalog('/api/platform/v1/services/catalog', contextScopeKey, signal);
}

/** Services Work home catalog: both `view` and `surface` must be absent. */
export async function getServiceHomeCatalog(signal?: AbortSignal): Promise<ServiceCatalog> {
  return readServiceCatalog('/api/platform/v1/services/catalog', undefined, signal);
}

/** Services Work discovery catalog: registry-fixed `view=discover`, no `surface`. */
export async function getServiceDiscoverCatalog(signal?: AbortSignal): Promise<ServiceCatalog> {
  return readServiceCatalog('/api/platform/v1/services/catalog?view=discover', undefined, signal);
}

/** Services Management public catalog projection: fixed view plus selected scope. */
export async function getServiceManagementCatalog(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ServiceCatalog> {
  return readServiceCatalog(
    '/api/platform/v1/services/catalog?view=management',
    contextScopeKey,
    signal
  );
}

/** HCM personal service catalog: registry-fixed `surface=hcm`, no view default. */
export async function getHcmServiceCatalog(signal?: AbortSignal): Promise<ServiceCatalog> {
  return readServiceCatalog('/api/platform/v1/services/catalog?surface=hcm', undefined, signal);
}

export async function getMyServiceRequests(
  status?: ServiceRequestStatus
): Promise<ServiceRequestSummary[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return readServiceRequests(`/api/platform/v1/services/requests${suffix}`);
}

/** Services Work home requests: both `view` and `surface` must be absent. */
export async function getServiceHomeRequests(
  signal?: AbortSignal
): Promise<ServiceRequestSummary[]> {
  return readServiceRequests('/api/platform/v1/services/requests', signal);
}

/** Services Work active-request list: registry-fixed `view=my`, no `surface`. */
export async function getServiceMyRequests(signal?: AbortSignal): Promise<ServiceRequestSummary[]> {
  return readServiceRequests('/api/platform/v1/services/requests?view=my', signal);
}

/** Services Work draft list: registry-fixed `view=drafts`, no `surface`. */
export async function getServiceDraftRequests(
  signal?: AbortSignal
): Promise<ServiceRequestSummary[]> {
  return readServiceRequests('/api/platform/v1/services/requests?view=drafts', signal);
}

/** HCM personal service requests: registry-fixed `surface=hcm`, no view default. */
export async function getHcmServiceRequests(
  signal?: AbortSignal
): Promise<ServiceRequestSummary[]> {
  return readServiceRequests('/api/platform/v1/services/requests?surface=hcm', signal);
}

export async function getMyServiceRequest(requestId: string): Promise<ServiceRequestDetail> {
  return readServiceRequest(requestId, '');
}

/** Services Work active-request detail: the `view` discriminator must remain absent. */
export async function getServiceMyRequest(
  requestId: string,
  signal?: AbortSignal
): Promise<ServiceRequestDetail> {
  return readServiceRequest(requestId, '', signal);
}

/** Services Work draft detail: registry-fixed `view=draft`. */
export async function getServiceDraftRequest(
  requestId: string,
  signal?: AbortSignal
): Promise<ServiceRequestDetail> {
  return readServiceRequest(requestId, '?view=draft', signal);
}

export async function createServiceRequest(
  input: {
    serviceKey: string;
    summary: string;
    values: Record<string, unknown>;
    idempotencyKey: string;
    submit: boolean;
  },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.post<ApiResponse<ServiceRequestDetail>, typeof input>(
    '/api/platform/v1/services/requests',
    input,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function updateServiceDraft(
  requestId: string,
  input: { summary: string; values: Record<string, unknown>; version: number; submit?: boolean },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.put<ApiResponse<ServiceRequestDetail>, typeof input>(
    `/api/platform/v1/services/requests/${requestId}/draft`,
    input,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function submitServiceDraft(
  requestId: string,
  version: number,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.post<ApiResponse<ServiceRequestDetail>, { version: number }>(
    `/api/platform/v1/services/requests/${requestId}/submit`,
    { version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function cancelServiceRequest(
  requestId: string,
  version: number,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.post<ApiResponse<ServiceRequestDetail>, { version: number }>(
    `/api/platform/v1/services/requests/${requestId}/cancel`,
    { version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function getAdminServiceCatalog(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<AdminServiceCatalogItem[]> {
  const response = await axiosInstance.get<ApiResponse<AdminServiceCatalogItem[]>>(
    '/api/platform/v1/admin/services/catalog',
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function saveAdminServiceCatalogItem(
  input: {
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
  },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<AdminServiceCatalogItem> {
  if (input.version == null) {
    const response = await axiosInstance.post<ApiResponse<AdminServiceCatalogItem>, typeof input>(
      '/api/platform/v1/admin/services/catalog',
      input,
      productSurfaceGovernedMutationConfig(authority)
    );
    return response.data.data;
  }
  const response = await axiosInstance.put<ApiResponse<AdminServiceCatalogItem>, typeof input>(
    `/api/platform/v1/admin/services/catalog/${encodeURIComponent(input.serviceKey)}`,
    input,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function getServiceOperationsQueue(
  status?: ServiceRequestStatus,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ServiceRequestSummary[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await axiosInstance.get<ApiResponse<ServiceRequestSummary[]>>(
    `/api/platform/v1/admin/services/requests${suffix}`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getServiceOperationsRequest(
  requestId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.get<ApiResponse<ServiceRequestDetail>>(
    `/api/platform/v1/admin/services/requests/${requestId}`,
    selectedScope(contextScopeKey, signal)
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
  },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<ServiceRequestDetail> {
  const response = await axiosInstance.post<ApiResponse<ServiceRequestDetail>, typeof input>(
    `/api/platform/v1/admin/services/requests/${requestId}/transition`,
    input,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}
