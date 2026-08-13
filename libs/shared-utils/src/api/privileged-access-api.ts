import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type PrivilegedAccessPolicy = {
  policyId: number;
  roleId: number;
  roleCode: string;
  roleName: string;
  activationMode: 'SELF_SERVICE' | 'APPROVAL' | 'DISABLED';
  maximumDurationMinutes: number;
  assuranceLevel: 'SESSION' | 'MFA' | 'PHISHING_RESISTANT';
  approvalQuorum: number;
  emergencyMode: 'DISABLED' | 'REGISTERED_PRINCIPAL' | 'DUAL_APPROVAL';
  ticketRequired: boolean;
  lifecycleState: 'ACTIVE' | 'RETIRED';
  version: number;
};

export type PrivilegedRoleEligibility = {
  eligibilityId: string;
  principalType: 'USER' | 'GROUP';
  principalId: number;
  principalDisplayName?: string | null;
  roleId: number;
  roleCode: string;
  roleName: string;
  scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
  scopeRef?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  justification: string;
  lifecycleState: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  version: number;
};

export type PrivilegedApproval = {
  approverUserId: number;
  approverDisplayName?: string | null;
  decision: 'APPROVE' | 'DENY';
  reason: string;
  decidedAt: string;
};

export type PrivilegedAccessRequest = {
  requestId: string;
  requesterUserId: number;
  requesterDisplayName?: string | null;
  roleId: number;
  roleCode: string;
  roleName: string;
  eligibilityId?: string | null;
  requestType: 'JIT' | 'EMERGENCY';
  scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
  scopeRef?: string | null;
  durationMinutes: number;
  justification: string;
  ticketReference?: string | null;
  assuranceLevel: 'SESSION' | 'MFA' | 'PHISHING_RESISTANT';
  approvalQuorum: number;
  lifecycleState: 'PENDING_APPROVAL' | 'ACTIVE' | 'DENIED' | 'CANCELLED' | 'REVOKED' | 'EXPIRED';
  requestedAt: string;
  activatedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  version: number;
  approvals: PrivilegedApproval[];
};

export type EmergencyAccessPrincipal = {
  emergencyPrincipalId: string;
  userId: number;
  displayName?: string | null;
  justification: string;
  reviewDueAt: string;
  lifecycleState: 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
  version: number;
};

export type DelegatedAdminScope = {
  scopeId: string;
  administratorUserId: number;
  administratorDisplayName?: string | null;
  scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
  scopeRef?: string | null;
  actionCode: string;
  validFrom?: string | null;
  validTo?: string | null;
  lifecycleState: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  justification: string;
  version: number;
};

const BASE = '/api/auth/admin/access/privileged';

export async function listPrivilegedAccessPolicies(): Promise<PrivilegedAccessPolicy[]> {
  const response = await axiosInstance.get<ApiResponse<PrivilegedAccessPolicy[]>>(
    `${BASE}/policies`
  );
  return response.data.data;
}

export async function updatePrivilegedAccessPolicy(
  policy: PrivilegedAccessPolicy,
  changes: Omit<PrivilegedAccessPolicy, 'policyId' | 'roleId' | 'roleCode' | 'roleName' | 'version'>
): Promise<PrivilegedAccessPolicy> {
  const response = await axiosInstance.put<
    ApiResponse<PrivilegedAccessPolicy>,
    typeof changes & { version: number }
  >(`${BASE}/policies/${policy.policyId}`, { ...changes, version: policy.version });
  return response.data.data;
}

export async function listPrivilegedRoleEligibilities(): Promise<PrivilegedRoleEligibility[]> {
  const response = await axiosInstance.get<ApiResponse<PrivilegedRoleEligibility[]>>(
    `${BASE}/eligibilities`
  );
  return response.data.data;
}

export async function listMyPrivilegedRoleEligibilities(): Promise<PrivilegedRoleEligibility[]> {
  const response = await axiosInstance.get<ApiResponse<PrivilegedRoleEligibility[]>>(
    `${BASE}/me/eligibilities`
  );
  return response.data.data;
}

export async function createPrivilegedRoleEligibility(request: {
  principalType: 'USER' | 'GROUP';
  principalId: number;
  roleId: number;
  scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
  scopeRef?: string;
  validFrom?: string;
  validTo?: string;
  justification: string;
}): Promise<PrivilegedRoleEligibility> {
  const response = await axiosInstance.post<ApiResponse<PrivilegedRoleEligibility>, typeof request>(
    `${BASE}/eligibilities`,
    request
  );
  return response.data.data;
}

export async function revokePrivilegedRoleEligibility(
  eligibility: PrivilegedRoleEligibility
): Promise<PrivilegedRoleEligibility> {
  const response = await axiosInstance.patch<ApiResponse<PrivilegedRoleEligibility>, undefined>(
    `${BASE}/eligibilities/${eligibility.eligibilityId}/revoke?version=${eligibility.version}`,
    undefined
  );
  return response.data.data;
}

export async function listPrivilegedAccessRequests(): Promise<PrivilegedAccessRequest[]> {
  const response = await axiosInstance.get<ApiResponse<PrivilegedAccessRequest[]>>(
    `${BASE}/requests`
  );
  return response.data.data;
}

export async function listMyPrivilegedAccessRequests(): Promise<PrivilegedAccessRequest[]> {
  const response = await axiosInstance.get<ApiResponse<PrivilegedAccessRequest[]>>(
    `${BASE}/me/requests`
  );
  return response.data.data;
}

export async function requestPrivilegedAccess(request: {
  eligibilityId?: string;
  roleId?: number;
  requestType: 'JIT' | 'EMERGENCY';
  durationMinutes: number;
  justification: string;
  ticketReference?: string;
}): Promise<PrivilegedAccessRequest> {
  const response = await axiosInstance.post<ApiResponse<PrivilegedAccessRequest>, typeof request>(
    `${BASE}/requests`,
    request
  );
  return response.data.data;
}

export async function decidePrivilegedAccessRequest(
  request: PrivilegedAccessRequest,
  decision: 'APPROVE' | 'DENY',
  reason: string
): Promise<PrivilegedAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<PrivilegedAccessRequest>,
    { decision: 'APPROVE' | 'DENY'; reason: string; version: number }
  >(`${BASE}/requests/${request.requestId}/decision`, {
    decision,
    reason,
    version: request.version,
  });
  return response.data.data;
}

export async function revokePrivilegedAccessRequest(
  request: PrivilegedAccessRequest,
  reason: string
): Promise<PrivilegedAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<PrivilegedAccessRequest>,
    { reason: string; version: number }
  >(`${BASE}/requests/${request.requestId}/revoke`, { reason, version: request.version });
  return response.data.data;
}

export async function listEmergencyAccessPrincipals(): Promise<EmergencyAccessPrincipal[]> {
  const response = await axiosInstance.get<ApiResponse<EmergencyAccessPrincipal[]>>(
    `${BASE}/emergency-principals`
  );
  return response.data.data;
}

export async function registerEmergencyAccessPrincipal(request: {
  userId: number;
  justification: string;
  reviewDueAt: string;
}): Promise<EmergencyAccessPrincipal> {
  const response = await axiosInstance.post<ApiResponse<EmergencyAccessPrincipal>, typeof request>(
    `${BASE}/emergency-principals`,
    request
  );
  return response.data.data;
}

export async function listDelegatedAdminScopes(): Promise<DelegatedAdminScope[]> {
  const response = await axiosInstance.get<ApiResponse<DelegatedAdminScope[]>>(
    `${BASE}/delegated-scopes`
  );
  return response.data.data;
}

export async function createDelegatedAdminScope(request: {
  administratorUserId: number;
  scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
  scopeRef?: string;
  actionCode: string;
  validFrom?: string;
  validTo?: string;
  justification: string;
}): Promise<DelegatedAdminScope> {
  const response = await axiosInstance.post<ApiResponse<DelegatedAdminScope>, typeof request>(
    `${BASE}/delegated-scopes`,
    request
  );
  return response.data.data;
}

export async function revokeDelegatedAdminScope(
  scope: DelegatedAdminScope
): Promise<DelegatedAdminScope> {
  const response = await axiosInstance.patch<ApiResponse<DelegatedAdminScope>, undefined>(
    `${BASE}/delegated-scopes/${scope.scopeId}/revoke?version=${scope.version}`,
    undefined
  );
  return response.data.data;
}
