import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type PermissionEffect = 'ALLOW' | 'DENY';

export type PermissionGrant = {
  resourceId: number;
  resourceType: string;
  resourceKey: string;
  resourceName: string;
  permissionCode: string;
  effect: PermissionEffect;
};

export type GovernanceRole = {
  roleId: number;
  code: string;
  name: string;
  description?: string | null;
  roleType: string;
  privileged: boolean;
  assignableToGroups: boolean;
  status: string;
  version: number;
  permissions: PermissionGrant[];
};

export type GovernanceResource = {
  resourceId: number;
  type: string;
  key: string;
  name: string;
  enabled: boolean;
};

export type GroupRoleAssignment = {
  assignmentId: number;
  groupId: number;
  groupName: string;
  roleId: number;
  roleCode: string;
  assignmentType: 'ACTIVE' | 'ELIGIBLE';
  scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
  scopeRef?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  lifecycleState: string;
  justification: string;
  version: number;
};

export type EffectiveAccess = {
  userId: number;
  displayName: string;
  accessRevision: number;
  roles: Array<{
    roleId: number;
    roleCode: string;
    source: string;
    sourceGroupId?: number | null;
    sourceGroupName?: string | null;
    scopeType?: string | null;
    scopeRef?: string | null;
    validTo?: string | null;
  }>;
  permissions: Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: PermissionEffect;
    grantedByRoles: string[];
  }>;
};

export type CreateGovernanceRoleRequest = {
  code: string;
  name: string;
  description?: string;
  privileged: boolean;
  assignableToGroups: boolean;
};

export type PermissionSelection = {
  resourceId: number;
  permissionCode: string;
  effect: PermissionEffect;
};

export type CreateGroupRoleAssignmentRequest = {
  groupId: number;
  roleId: number;
  assignmentType: 'ACTIVE';
  scopeType: 'TENANT' | 'ORG_UNIT' | 'RESOURCE';
  scopeRef?: string;
  validFrom?: string;
  validTo?: string;
  justification: string;
};

const BASE = '/api/auth/admin/access/governance';

export async function listGovernanceRoles(): Promise<GovernanceRole[]> {
  const response = await axiosInstance.get<ApiResponse<GovernanceRole[]>>(`${BASE}/roles`);
  return response.data.data;
}

export async function createGovernanceRole(
  request: CreateGovernanceRoleRequest
): Promise<GovernanceRole> {
  const response = await axiosInstance.post<
    ApiResponse<GovernanceRole>,
    CreateGovernanceRoleRequest
  >(`${BASE}/roles`, request);
  return response.data.data;
}

export async function updateGovernanceRole(
  role: GovernanceRole,
  request: Omit<CreateGovernanceRoleRequest, 'code'> & { status: string }
): Promise<GovernanceRole> {
  const response = await axiosInstance.put<
    ApiResponse<GovernanceRole>,
    typeof request & { version: number }
  >(`${BASE}/roles/${role.roleId}`, { ...request, version: role.version });
  return response.data.data;
}

export async function replaceGovernanceRolePermissions(
  role: GovernanceRole,
  permissions: PermissionSelection[]
): Promise<GovernanceRole> {
  const response = await axiosInstance.put<
    ApiResponse<GovernanceRole>,
    { version: number; permissions: PermissionSelection[] }
  >(`${BASE}/roles/${role.roleId}/permissions`, { version: role.version, permissions });
  return response.data.data;
}

export async function listGovernanceResources(): Promise<GovernanceResource[]> {
  const response = await axiosInstance.get<ApiResponse<GovernanceResource[]>>(`${BASE}/resources`);
  return response.data.data;
}

export async function createGovernanceResource(request: {
  type: string;
  key: string;
  name: string;
}): Promise<GovernanceResource> {
  const response = await axiosInstance.post<ApiResponse<GovernanceResource>, typeof request>(
    `${BASE}/resources`,
    request
  );
  return response.data.data;
}

export async function listGroupRoleAssignments(): Promise<GroupRoleAssignment[]> {
  const response = await axiosInstance.get<ApiResponse<GroupRoleAssignment[]>>(
    `${BASE}/group-role-assignments`
  );
  return response.data.data;
}

export async function createGroupRoleAssignment(
  request: CreateGroupRoleAssignmentRequest
): Promise<GroupRoleAssignment> {
  const response = await axiosInstance.post<
    ApiResponse<GroupRoleAssignment>,
    CreateGroupRoleAssignmentRequest
  >(`${BASE}/group-role-assignments`, request);
  return response.data.data;
}

export async function revokeGroupRoleAssignment(
  assignment: GroupRoleAssignment
): Promise<GroupRoleAssignment> {
  const response = await axiosInstance.patch<ApiResponse<GroupRoleAssignment>, undefined>(
    `${BASE}/group-role-assignments/${assignment.assignmentId}/revoke?version=${assignment.version}`,
    undefined
  );
  return response.data.data;
}

export async function getEffectiveAccess(userId: number): Promise<EffectiveAccess> {
  const response = await axiosInstance.get<ApiResponse<EffectiveAccess>>(
    `${BASE}/users/${userId}/effective-access`
  );
  return response.data.data;
}
