import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type WorkforceExportDatasetKey =
  | 'ORGANIZATION_INTELLIGENCE'
  | 'WORKFORCE_DIRECTORY'
  | 'ASSIGNMENT_REGISTER';

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
    | 'BLOCKED'
    | 'CLAIMED'
    | 'RETRY_SCHEDULED'
    | 'FAILED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'EXPIRED';
  workerReference?: string | null;
  failureCode?: string | null;
  redactedFailureMessage?: string | null;
  artifactSha256?: string | null;
  artifactSizeBytes?: number | null;
  occurredAt: string;
};

const BASE = '/api/people/v1/workforce/exports';

export async function listWorkforceExportDatasets(): Promise<WorkforceExportDataset[]> {
  const response = await axiosInstance.get<ApiResponse<WorkforceExportDataset[]>>(
    `${BASE}/datasets`
  );
  return response.data.data;
}

export async function previewWorkforceExport(
  datasetKey: WorkforceExportDatasetKey,
  selection: Record<string, string>
): Promise<WorkforceExportPreview> {
  const response = await axiosInstance.post<
    ApiResponse<WorkforceExportPreview>,
    { datasetKey: WorkforceExportDatasetKey; selection: Record<string, string> }
  >(`${BASE}/preview`, { datasetKey, selection });
  return response.data.data;
}

export async function listWorkforceExportRequests(): Promise<WorkforceExportRequest[]> {
  const response = await axiosInstance.get<ApiResponse<WorkforceExportRequest[]>>(BASE);
  return response.data.data;
}

export async function createWorkforceExportRequest(
  request: CreateWorkforceExportRequest
): Promise<WorkforceExportRequest> {
  const response = await axiosInstance.post<
    ApiResponse<WorkforceExportRequest>,
    CreateWorkforceExportRequest
  >(BASE, request);
  return response.data.data;
}

export async function cancelWorkforceExportRequest(
  request: WorkforceExportRequest,
  reason: string
): Promise<WorkforceExportRequest> {
  const response = await axiosInstance.patch<
    ApiResponse<WorkforceExportRequest>,
    { version: number; reason: string }
  >(`${BASE}/${request.requestId}/cancel`, { version: request.version, reason });
  return response.data.data;
}

export async function retryWorkforceExportRequest(
  request: WorkforceExportRequest,
  reason: string
): Promise<WorkforceExportRequest> {
  const response = await axiosInstance.patch<
    ApiResponse<WorkforceExportRequest>,
    { version: number; reason: string }
  >(`${BASE}/${request.requestId}/retry`, { version: request.version, reason });
  return response.data.data;
}

export async function listWorkforceExportAttempts(
  requestId: string
): Promise<WorkforceExportAttempt[]> {
  const response = await axiosInstance.get<ApiResponse<WorkforceExportAttempt[]>>(
    `${BASE}/${requestId}/attempts`
  );
  return response.data.data;
}
