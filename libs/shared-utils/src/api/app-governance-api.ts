import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type AppResponsibility = {
  code: string;
  displayName: string;
  description: string;
  riskTier: 'L1' | 'L2' | 'L3';
  sortOrder: number;
};

export type AppResourceMember = {
  resourceType: string;
  resourceKey: string;
  resourceName: string;
};

export type AppResourceSet = {
  resourceSetId: string;
  key: string;
  name: string;
  description?: string | null;
  lifecycleState: string;
  version: number;
  resources: AppResourceMember[];
};

export type AppAdminAssignment = {
  assignmentId: string;
  principalType: 'USER' | 'GROUP';
  principalRef: string;
  principalName: string;
  responsibilityCode: string;
  resourceSetId: string;
  resourceSetKey: string;
  resourceSetName: string;
  assignmentSource: string;
  lifecycleState: 'PENDING_APPROVAL' | 'ACTIVE' | 'DENIED' | 'REVOKED' | 'EXPIRED';
  validFrom?: string | null;
  validTo?: string | null;
  reviewDueAt: string;
  justification: string;
  requestedBy?: number | null;
  requestedByName?: string | null;
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  decisionReason?: string | null;
  /**
   * Actor-specific, read-only affordance hint computed by Auth. Execution always
   * revalidates the one-time bootstrap predicate under the resource-set lock.
   */
  firstApproverBootstrapEligible: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AppAdminPresetDuty = {
  dutyCode: string;
  legacyRoleCode?: string | null;
  resourceKey: string;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  auditPolicyException: boolean;
  capabilityContractKeys: string[];
};

export type AppAdminPresetCatalogItem = {
  presetCode: string;
  productKey: string;
  appResourceKey: string;
  displayName: string;
  description: string;
  responsibilityCode: string;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  catalogVersion: number;
  duties: AppAdminPresetDuty[];
  requestable?: boolean;
  unavailableReason?: string | null;
};

export type AppAdminPresetDutyAssignment = {
  assignmentId: string;
  dutyCode: string;
  lifecycleState: string;
  version: number;
};

export type AppAdminPresetAssignment = {
  presetAssignmentId: string;
  presetCode: string;
  productKey: string;
  presetName: string;
  principalType: 'USER' | 'GROUP';
  principalRef: string;
  principalName: string;
  resourceSetId: string;
  resourceSetKey: string;
  resourceSetName: string;
  responsibilityAssignmentId: string;
  assignmentSource: string;
  requestChannel: 'SELF_SERVICE' | 'GOVERNANCE';
  lifecycleState: 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'DENIED' | 'REVOKED' | 'EXPIRED';
  validFrom?: string | null;
  validTo: string;
  reviewDueAt: string;
  justification: string;
  requestedBy?: number | null;
  requestedByName?: string | null;
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  decisionReason?: string | null;
  activatedBy?: number | null;
  activatedByName?: string | null;
  activatedAt?: string | null;
  activationReason?: string | null;
  revokedBy?: number | null;
  revokedByName?: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
  version: number;
  catalogVersion: number;
  createdAt: string;
  updatedAt: string;
  duties: AppAdminPresetDutyAssignment[];
};

export type AppAdminPresetSelfServiceOption = {
  preset: AppAdminPresetCatalogItem;
  resourceSets: Array<{
    resourceSetId: string;
    resourceSetKey: string;
    resourceSetName: string;
  }>;
};

export type AppAdminPresetReview = {
  reviewId: string;
  userId: number;
  userName: string;
  resourceSetId: string;
  resourceSetName?: string | null;
  sourceRoleCode: string;
  dutyCode: string;
  reasonCode: string;
  evidence: unknown;
  lifecycleState: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  resolvedBy?: number | null;
  resolvedAt?: string | null;
  resolutionReason?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AppGovernanceDashboard = {
  metrics: {
    activeAssignments: number;
    pendingApprovals: number;
    reviewsDueSoon: number;
    resourcesWithoutOwner: number;
  };
  responsibilities: AppResponsibility[];
  principals: Array<{
    type: 'USER' | 'GROUP';
    ref: string;
    displayName: string;
    detail?: string | null;
  }>;
  resourceSets: AppResourceSet[];
  assignments: AppAdminAssignment[];
  presetCatalog?: AppAdminPresetCatalogItem[];
  presetAssignments?: AppAdminPresetAssignment[];
  presetReviews?: AppAdminPresetReview[];
};

const BASE = '/api/auth/admin/access/app-governance';

export async function getAppGovernanceDashboard(): Promise<AppGovernanceDashboard> {
  const response = await axiosInstance.get<ApiResponse<AppGovernanceDashboard>>(BASE);
  return response.data.data;
}

export async function createAppAdminAssignment(payload: {
  principalType: 'USER' | 'GROUP';
  principalRef: string;
  responsibilityCode: string;
  resourceSetId: string;
  validTo?: string | null;
  justification: string;
}): Promise<AppAdminAssignment> {
  const response = await axiosInstance.post<ApiResponse<AppAdminAssignment>, typeof payload>(
    `${BASE}/assignments`,
    payload
  );
  return response.data.data;
}

export async function createAppResourceSet(payload: {
  key: string;
  name: string;
  description?: string | null;
  resourceKeys: string[];
}): Promise<AppResourceSet> {
  const response = await axiosInstance.post<ApiResponse<AppResourceSet>, typeof payload>(
    `${BASE}/resource-sets`,
    payload
  );
  return response.data.data;
}

export async function updateAppResourceSet(
  resourceSet: AppResourceSet,
  payload: { name: string; description?: string | null; resourceKeys: string[] }
): Promise<AppResourceSet> {
  const response = await axiosInstance.put<
    ApiResponse<AppResourceSet>,
    typeof payload & { version: number }
  >(`${BASE}/resource-sets/${resourceSet.resourceSetId}`, {
    ...payload,
    version: resourceSet.version,
  });
  return response.data.data;
}

export async function decideAppAdminAssignment(
  assignment: AppAdminAssignment,
  decision: 'APPROVED' | 'DENIED',
  reason: string
): Promise<AppAdminAssignment> {
  const response = await axiosInstance.post<
    ApiResponse<AppAdminAssignment>,
    { decision: string; reason: string; version: number }
  >(`${BASE}/assignments/${assignment.assignmentId}/decision`, {
    decision,
    reason,
    version: assignment.version,
  });
  return response.data.data;
}

export async function revokeAppAdminAssignment(
  assignment: AppAdminAssignment,
  reason: string
): Promise<AppAdminAssignment> {
  const response = await axiosInstance.patch<
    ApiResponse<AppAdminAssignment>,
    { reason: string; version: number }
  >(`${BASE}/assignments/${assignment.assignmentId}/revoke`, {
    reason,
    version: assignment.version,
  });
  return response.data.data;
}

export async function getAppAdminPresetCatalog(): Promise<AppAdminPresetCatalogItem[]> {
  const response = await axiosInstance.get<ApiResponse<AppAdminPresetCatalogItem[]>>(
    `${BASE}/presets/catalog`
  );
  return response.data.data;
}

export async function getAppAdminPresetAssignments(): Promise<AppAdminPresetAssignment[]> {
  const response = await axiosInstance.get<ApiResponse<AppAdminPresetAssignment[]>>(
    `${BASE}/presets/assignments`
  );
  return response.data.data;
}

export async function getAppAdminPresetAssignment(
  presetAssignmentId: string
): Promise<AppAdminPresetAssignment> {
  const response = await axiosInstance.get<ApiResponse<AppAdminPresetAssignment>>(
    `${BASE}/presets/assignments/${presetAssignmentId}`
  );
  return response.data.data;
}

export async function createAppAdminPresetAssignment(payload: {
  principalType: 'USER' | 'GROUP';
  principalRef: string;
  presetCode: string;
  resourceSetId: string;
  validTo: string;
  reviewDueAt: string;
  justification: string;
}): Promise<AppAdminPresetAssignment> {
  const response = await axiosInstance.post<ApiResponse<AppAdminPresetAssignment>, typeof payload>(
    `${BASE}/presets/assignments`,
    payload
  );
  return response.data.data;
}

export async function getAppAdminPresetSelfServiceOptions(
  appResourceKey: string
): Promise<AppAdminPresetSelfServiceOption[]> {
  const response = await axiosInstance.get<ApiResponse<AppAdminPresetSelfServiceOption[]>>(
    `${BASE}/presets/self-service-options?appResourceKey=${encodeURIComponent(appResourceKey)}`
  );
  return response.data.data;
}

export async function createAppAdminPresetSelfServiceRequest(
  payload: {
    presetCode: string;
    resourceSetId: string;
    validTo: string;
    reviewDueAt: string;
    justification: string;
  },
  idempotencyKey: string,
  correlationId?: string
): Promise<AppAdminPresetAssignment> {
  const normalizedKey = idempotencyKey.trim();
  if (
    normalizedKey.length < 8 ||
    normalizedKey.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(normalizedKey)
  ) {
    throw new Error('App administrator self-service request requires a valid idempotency key.');
  }
  const response = await axiosInstance.post<ApiResponse<AppAdminPresetAssignment>, typeof payload>(
    `${BASE}/presets/self-service-requests`,
    payload,
    {
      headers: {
        'Idempotency-Key': normalizedKey,
        ...(correlationId ? { 'X-Correlation-ID': correlationId } : {}),
      },
    }
  );
  return response.data.data;
}

export async function decideAppAdminPresetAssignment(
  assignment: AppAdminPresetAssignment,
  decision: 'APPROVED' | 'DENIED',
  reason: string
): Promise<AppAdminPresetAssignment> {
  const response = await axiosInstance.post<
    ApiResponse<AppAdminPresetAssignment>,
    { decision: string; reason: string; version: number }
  >(`${BASE}/presets/assignments/${assignment.presetAssignmentId}/decision`, {
    decision,
    reason,
    version: assignment.version,
  });
  return response.data.data;
}

export async function activateAppAdminPresetAssignment(
  assignment: AppAdminPresetAssignment,
  reason: string
): Promise<AppAdminPresetAssignment> {
  const response = await axiosInstance.post<
    ApiResponse<AppAdminPresetAssignment>,
    { reason: string; version: number }
  >(`${BASE}/presets/assignments/${assignment.presetAssignmentId}/activate`, {
    reason,
    version: assignment.version,
  });
  return response.data.data;
}

export async function revokeAppAdminPresetAssignment(
  assignment: AppAdminPresetAssignment,
  reason: string
): Promise<AppAdminPresetAssignment> {
  const response = await axiosInstance.patch<
    ApiResponse<AppAdminPresetAssignment>,
    { reason: string; version: number }
  >(`${BASE}/presets/assignments/${assignment.presetAssignmentId}/revoke`, {
    reason,
    version: assignment.version,
  });
  return response.data.data;
}

export async function decideAppAdminPresetReview(
  review: AppAdminPresetReview,
  decision: 'RESOLVED' | 'DISMISSED',
  reason: string
): Promise<AppAdminPresetReview> {
  const response = await axiosInstance.post<
    ApiResponse<AppAdminPresetReview>,
    { decision: string; reason: string; version: number }
  >(`${BASE}/presets/reviews/${review.reviewId}/decision`, {
    decision,
    reason,
    version: review.version,
  });
  return response.data.data;
}
