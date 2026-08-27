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
export type SavedViewCustodyEligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'NOT_EVALUATED';
export type SavedViewCustodyIneligibilityReason =
  | 'NO_AFFECTED_VIEWS'
  | 'SOURCE_OWNER_NOT_SUCCESSOR'
  | 'SELF_ASSIGNMENT_NOT_ALLOWED'
  | 'IDENTITY_NOT_ELIGIBLE'
  | 'EVALUATION_UNAVAILABLE'
  | 'MISSING_SURFACE_ACCESS'
  | 'MISSING_TEAM_MEMBERSHIP'
  | 'MISSING_SHARED_VIEW_ADMIN_ROLE'
  | 'PERSONAL_NAME_CONFLICT';

export type SavedViewOrphanReassignmentBlockReason = 'SHARED_NAME_CONFLICT';

export type SavedViewCustodyUser = {
  tenantId: number;
  userId: number;
  displayName: string;
  email?: string | null;
  jobTitle?: string | null;
  status: string;
  identityPlane?: string | null;
  eligibilityStatus?: SavedViewCustodyEligibilityStatus;
  ineligibilityReasons?: SavedViewCustodyIneligibilityReason[];
};

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

export type SavedViewOwnershipNameConflict = {
  incomingSavedViewId: string;
  incomingName: string;
  surfaceKey: string;
  existingTargetSavedViewId: string;
  existingTargetName: string;
};

export type SavedViewOwnershipPreview = {
  sourceOwnerUserId: number;
  disposition: SavedViewOwnershipDisposition;
  targetOwnerUserId?: number | null;
  retentionUntil?: string | null;
  affectedCount: number;
  ownershipFingerprint: string;
  views: SavedViewOwnershipCandidate[];
  nameConflicts: SavedViewOwnershipNameConflict[];
  evaluatedAt: string;
};

export type SavedViewOwnershipTransfer = {
  transferBatchId: string;
  idempotencyKey: string;
  sourceOwnerUserId: number;
  sourceOwnerDisplayName?: string | null;
  targetOwnerUserId?: number | null;
  targetOwnerDisplayName?: string | null;
  disposition: SavedViewOwnershipDisposition;
  reasonCode: SavedViewOwnershipReason;
  reason: string;
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
  reassignmentBlockReason?: SavedViewOrphanReassignmentBlockReason | null;
  retentionUntil: string;
  version: number;
  updatedAt: string;
};

export type OrphanLifecycleAction = 'REASSIGN' | 'EXTEND_RETENTION' | 'ARCHIVE';
export type OrphanLifecycleResultAction = 'REASSIGN' | 'EXTEND_RETENTION' | 'ARCHIVE_NOW';

export type OrphanLifecycleEvidence = {
  idempotencyKey: string;
  version: number;
  reasonCode: SavedViewOwnershipReason;
  reason: string;
  sourceReference: string;
};

export type OrphanLifecycleResult = {
  commandId: string;
  idempotencyKey: string;
  savedViewId: string;
  savedViewName: string;
  surfaceKey: string;
  scope: SavedViewScope;
  action: OrphanLifecycleResultAction;
  targetOwnerUserId?: number | null;
  targetOwnerDisplayName?: string | null;
  previousLifecycleState: GovernedSavedView['lifecycleState'];
  newLifecycleState: GovernedSavedView['lifecycleState'];
  previousRetentionUntil?: string | null;
  nextRetentionUntil?: string | null;
  reasonCode: SavedViewOwnershipReason;
  reason: string;
  sourceReference: string;
  requestFingerprint: string;
  previousVersion: number;
  resultingVersion: number;
  createdAt: string;
  createdBy: number;
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

export async function listSavedViewCustodyUsers(
  query = '',
  activeOnly = false,
  limit = 30,
  sourceOwnerUserId?: number | null,
  savedViewId?: string | null
): Promise<SavedViewCustodyUser[]> {
  const search = new URLSearchParams({
    query: query.trim(),
    activeOnly: String(activeOnly),
    limit: String(Math.max(1, Math.min(limit, 30))),
  });
  if (sourceOwnerUserId != null) search.set('sourceOwnerUserId', String(sourceOwnerUserId));
  if (savedViewId) search.set('savedViewId', savedViewId);
  const response = await axiosInstance.get<ApiResponse<SavedViewCustodyUser[]>>(
    OWNERSHIP_BASE + '/users?' + search.toString()
  );
  return response.data.data;
}

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

export async function listOrphanLifecycleActions(limit = 50): Promise<OrphanLifecycleResult[]> {
  const response = await axiosInstance.get<ApiResponse<OrphanLifecycleResult[]>>(
    `${OWNERSHIP_BASE}/orphaned/actions?limit=${Math.max(1, Math.min(limit, 100))}`
  );
  return response.data.data;
}

export async function reassignOrphanedSavedView(
  savedViewId: string,
  request: OrphanLifecycleEvidence & { targetOwnerUserId: number }
): Promise<OrphanLifecycleResult> {
  const response = await axiosInstance.post<ApiResponse<OrphanLifecycleResult>, typeof request>(
    `${OWNERSHIP_BASE}/orphaned/${encodeURIComponent(savedViewId)}/reassign`,
    request
  );
  return response.data.data;
}

export async function extendOrphanedSavedViewRetention(
  savedViewId: string,
  request: OrphanLifecycleEvidence & { retentionUntil: string }
): Promise<OrphanLifecycleResult> {
  const response = await axiosInstance.post<ApiResponse<OrphanLifecycleResult>, typeof request>(
    `${OWNERSHIP_BASE}/orphaned/${encodeURIComponent(savedViewId)}/extend-retention`,
    request
  );
  return response.data.data;
}

export async function archiveOrphanedSavedView(
  savedViewId: string,
  request: OrphanLifecycleEvidence
): Promise<OrphanLifecycleResult> {
  const response = await axiosInstance.post<ApiResponse<OrphanLifecycleResult>, typeof request>(
    `${OWNERSHIP_BASE}/orphaned/${encodeURIComponent(savedViewId)}/archive`,
    request
  );
  return response.data.data;
}
