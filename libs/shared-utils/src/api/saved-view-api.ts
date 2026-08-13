import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type SavedViewScope = 'PERSONAL' | 'TEAM' | 'TENANT';
export type SavedViewConfiguration = Record<string, unknown>;

export type GovernedSavedView = {
  savedViewId: string;
  surfaceKey: string;
  name: string;
  scope: SavedViewScope;
  ownerUserId?: number | null;
  ownerGroupRef?: string | null;
  lifecycleState: 'ACTIVE' | 'ORPHANED' | 'ARCHIVED';
  retentionUntil?: string | null;
  editable: boolean;
  favorite: boolean;
  defaultView: boolean;
  configuration: SavedViewConfiguration;
  version: number;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSavedViewRequest = {
  name: string;
  scope: SavedViewScope;
  ownerGroupRef?: string | null;
  configuration: SavedViewConfiguration;
  favorite: boolean;
  defaultView: boolean;
};

export type UpdateSavedViewRequest = Pick<
  CreateSavedViewRequest,
  'name' | 'scope' | 'ownerGroupRef' | 'configuration'
> & { version: number };

export type SavedViewOwnershipDisposition = 'TRANSFER' | 'RETAIN_ORPHANED';
export type SavedViewOwnershipReason = 'OFFBOARDING' | 'TEAM_REORGANIZATION' | 'OWNER_CORRECTION';

export type SavedViewOwnershipPlanRequest = {
  sourceOwnerUserId: number;
  disposition: SavedViewOwnershipDisposition;
  targetOwnerUserId?: number | null;
  reasonCode: SavedViewOwnershipReason;
  reason: string;
  sourceReference: string;
  retentionUntil?: string | null;
};

export type SavedViewOwnershipCandidate = {
  savedViewId: string;
  surfaceKey: string;
  name: string;
  scope: SavedViewScope;
  ownerGroupRef?: string | null;
  version: number;
  updatedAt: string;
};

export type SavedViewOwnershipPreview = {
  sourceOwnerUserId: number;
  disposition: SavedViewOwnershipDisposition;
  targetOwnerUserId?: number | null;
  retentionUntil?: string | null;
  affectedCount: number;
  ownershipFingerprint: string;
  views: SavedViewOwnershipCandidate[];
  evaluatedAt: string;
};

export type SavedViewOwnershipTransfer = {
  transferBatchId: string;
  idempotencyKey: string;
  sourceOwnerUserId: number;
  targetOwnerUserId?: number | null;
  disposition: SavedViewOwnershipDisposition;
  reasonCode: SavedViewOwnershipReason;
  sourceReference: string;
  retentionUntil?: string | null;
  transferredCount: number;
  ownershipFingerprint: string;
  requestFingerprint: string;
  createdAt: string;
  createdBy: number;
};

export type SavedViewOwnershipTransferSummary = Omit<
  SavedViewOwnershipTransfer,
  'idempotencyKey' | 'ownershipFingerprint' | 'requestFingerprint'
>;

export type OrphanedSavedView = {
  savedViewId: string;
  surfaceKey: string;
  name: string;
  scope: SavedViewScope;
  ownerGroupRef?: string | null;
  retentionUntil: string;
  updatedAt: string;
};

export async function getSavedViews(surfaceKey: string): Promise<GovernedSavedView[]> {
  const response = await axiosInstance.get<ApiResponse<GovernedSavedView[]>>(
    `/api/platform/v1/workspace/saved-views?surfaceKey=${encodeURIComponent(surfaceKey)}`
  );
  return response.data.data;
}

export async function createSavedView(
  surfaceKey: string,
  request: CreateSavedViewRequest
): Promise<GovernedSavedView> {
  const response = await axiosInstance.post<ApiResponse<GovernedSavedView>, CreateSavedViewRequest>(
    `/api/platform/v1/workspace/saved-views?surfaceKey=${encodeURIComponent(surfaceKey)}`,
    request,
    undefined
  );
  return response.data.data;
}

export async function updateSavedView(
  savedViewId: string,
  request: UpdateSavedViewRequest
): Promise<GovernedSavedView> {
  const response = await axiosInstance.put<ApiResponse<GovernedSavedView>, UpdateSavedViewRequest>(
    `/api/platform/v1/workspace/saved-views/${encodeURIComponent(savedViewId)}`,
    request
  );
  return response.data.data;
}

export async function deleteSavedView(savedViewId: string): Promise<void> {
  await axiosInstance.delete(
    `/api/platform/v1/workspace/saved-views/${encodeURIComponent(savedViewId)}`
  );
}

export async function updateSavedViewPreference(
  savedViewId: string,
  preference: { favorite: boolean; defaultView: boolean }
): Promise<GovernedSavedView> {
  const response = await axiosInstance.put<
    ApiResponse<GovernedSavedView>,
    { favorite: boolean; defaultView: boolean }
  >(
    `/api/platform/v1/workspace/saved-views/${encodeURIComponent(savedViewId)}/preference`,
    preference
  );
  return response.data.data;
}

export async function markSavedViewUsed(savedViewId: string): Promise<void> {
  await axiosInstance.post(
    `/api/platform/v1/workspace/saved-views/${encodeURIComponent(savedViewId)}/use`,
    undefined
  );
}

const OWNERSHIP_BASE = '/api/platform/v1/admin/saved-view-ownership';

export async function previewSavedViewOwnership(
  request: SavedViewOwnershipPlanRequest
): Promise<SavedViewOwnershipPreview> {
  const response = await axiosInstance.post<
    ApiResponse<SavedViewOwnershipPreview>,
    SavedViewOwnershipPlanRequest
  >(`${OWNERSHIP_BASE}/preview`, request);
  return response.data.data;
}

export async function transferSavedViewOwnership(
  request: SavedViewOwnershipPlanRequest & {
    idempotencyKey: string;
    expectedCount: number;
    ownershipFingerprint: string;
  }
): Promise<SavedViewOwnershipTransfer> {
  const response = await axiosInstance.post<
    ApiResponse<SavedViewOwnershipTransfer>,
    typeof request
  >(`${OWNERSHIP_BASE}/transfers`, request);
  return response.data.data;
}

export async function listSavedViewOwnershipTransfers(
  limit = 50
): Promise<SavedViewOwnershipTransferSummary[]> {
  const response = await axiosInstance.get<ApiResponse<SavedViewOwnershipTransferSummary[]>>(
    `${OWNERSHIP_BASE}/transfers?limit=${Math.max(1, Math.min(limit, 100))}`
  );
  return response.data.data;
}

export async function listOrphanedSavedViews(): Promise<OrphanedSavedView[]> {
  const response = await axiosInstance.get<ApiResponse<OrphanedSavedView[]>>(
    `${OWNERSHIP_BASE}/orphaned`
  );
  return response.data.data;
}
