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
