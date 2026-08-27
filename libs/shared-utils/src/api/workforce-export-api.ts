import { axiosInstance } from '../axios-instance';
import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from './product-surface-governed-mutation';
import { productSurfaceReadScopeConfig } from './product-surface-read-scope';

import type { ApiResponse } from '../types';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

export type WorkforceExportDatasetKey =
  'ORGANIZATION_INTELLIGENCE' | 'WORKFORCE_DIRECTORY' | 'ASSIGNMENT_REGISTER';

export type WorkforceExportState =
  | 'BLOCKED_PENDING_APPROVAL'
  | 'QUEUED'
  | 'RUNNING'
  | 'RETRY_WAIT'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED';

export type WorkforceExportDataset = {
  datasetKey: WorkforceExportDatasetKey;
  name: string;
  description: string;
  requiredFieldGroups: string[];
  allowedSelectionKeys: string[];
  version: number;
};

export type WorkforceExportPreview = {
  authorized: boolean;
  executionEnabled: boolean;
  datasetKey: WorkforceExportDatasetKey;
  allowedSelectionKeys: string[];
  populationType: 'TENANT' | 'ORGANIZATION_SET';
  organizationIds: string[];
  fieldGroups: string[];
  exportFormat: 'CSV';
  maskingProfile: string;
  watermarkTemplate: string;
  artifactTtlHours: number;
  maximumAttempts: number;
  maximumManualRetries: number;
  blockers: string[];
  message: string;
  evaluatedAt: string;
};

export type CreateWorkforceExportRequest = {
  idempotencyKey: string;
  datasetKey: WorkforceExportDatasetKey;
  selection: Record<string, string>;
  exportFormat: 'CSV';
  recipientReference: string;
  purpose: string;
  sourceReference: string;
};

export type WorkforceExportRequest = {
  requestId: string;
  datasetKey: WorkforceExportDatasetKey;
  selection: Record<string, string>;
  populationType: 'TENANT' | 'ORGANIZATION_SET';
  organizationIds: string[];
  fieldGroups: string[];
  exportFormat: 'CSV';
  maskingProfile: string;
  watermarkText: string;
  recipientReference: string;
  purpose: string;
  sourceReference: string;
  lifecycleState: WorkforceExportState;
  executionEnabled: boolean;
  blockers: string[];
  requestSha256: string;
  artifactSha256?: string | null;
  artifactSizeBytes?: number | null;
  artifactExpiresAt?: string | null;
  attemptCount: number;
  retryCycleAttemptCount: number;
  manualRetryCount: number;
  nextAttemptAt?: string | null;
  cancellationRequestedAt?: string | null;
  completedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkforceExportAttempt = {
  attemptEventId: string;
  attemptNumber: number;
  eventType:
    'BLOCKED' | 'CLAIMED' | 'RETRY_SCHEDULED' | 'FAILED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  workerReference?: string | null;
  failureCode?: string | null;
  redactedFailureMessage?: string | null;
  artifactSha256?: string | null;
  artifactSizeBytes?: number | null;
  occurredAt: string;
};

const BASE = '/api/people/v1/workforce/exports';

export const HCM_WORKFORCE_EXPORT_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createWorkforceExportRequest',
    routeContractKey: 'route.hcm.management.controlled-export-create.action',
    method: 'POST',
    path: BASE,
  },
  {
    apiFunction: 'cancelWorkforceExportRequest',
    routeContractKey: 'route.hcm.management.controlled-export-cancel.action',
    method: 'PATCH',
    path: `${BASE}/{requestId}/cancel`,
  },
  {
    apiFunction: 'retryWorkforceExportRequest',
    routeContractKey: 'route.hcm.management.controlled-export-retry.action',
    method: 'PATCH',
    path: `${BASE}/{requestId}/retry`,
  },
] as const;

export async function listWorkforceExportDatasets(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<WorkforceExportDataset[]> {
  const response = await axiosInstance.get<ApiResponse<WorkforceExportDataset[]>>(
    `${BASE}/datasets`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function previewWorkforceExport(
  datasetKey: WorkforceExportDatasetKey,
  selection: Record<string, string>,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<WorkforceExportPreview> {
  const response = await axiosInstance.post<
    ApiResponse<WorkforceExportPreview>,
    { datasetKey: WorkforceExportDatasetKey; selection: Record<string, string> }
  >(
    `${BASE}/preview`,
    { datasetKey, selection },
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function listWorkforceExportRequests(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<WorkforceExportRequest[]> {
  const response = await axiosInstance.get<ApiResponse<WorkforceExportRequest[]>>(
    BASE,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function createWorkforceExportRequest(
  request: CreateWorkforceExportRequest,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<WorkforceExportRequest> {
  const response = await axiosInstance.post<
    ApiResponse<WorkforceExportRequest>,
    CreateWorkforceExportRequest
  >(BASE, request, productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true }));
  return response.data.data;
}

export async function cancelWorkforceExportRequest(
  requestId: string,
  version: number,
  reason: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<WorkforceExportRequest> {
  const response = await axiosInstance.patch<
    ApiResponse<WorkforceExportRequest>,
    { version: number; reason: string }
  >(
    `${BASE}/${requestId}/cancel`,
    { version, reason },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function retryWorkforceExportRequest(
  requestId: string,
  version: number,
  reason: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<WorkforceExportRequest> {
  const response = await axiosInstance.patch<
    ApiResponse<WorkforceExportRequest>,
    { version: number; reason: string }
  >(
    `${BASE}/${requestId}/retry`,
    { version, reason },
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  return response.data.data;
}

export async function listWorkforceExportAttempts(
  requestId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<WorkforceExportAttempt[]> {
  const response = await axiosInstance.get<ApiResponse<WorkforceExportAttempt[]>>(
    `${BASE}/${requestId}/attempts`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}
