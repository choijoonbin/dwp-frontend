import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResult } from './platform-admin-api';

export type DirectoryStatus = 'ACTIVE' | 'INACTIVE';
export type DirectorySource = 'LOCAL' | 'SCIM';

export type OrganizationUnit = {
  orgUnitId: number;
  orgKey: string;
  name: string;
  description?: string | null;
  parentOrgUnitId?: number | null;
  parentName?: string | null;
  sourceType: DirectorySource;
  status: DirectoryStatus;
  memberCount: number;
  revision: number;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type DirectoryGroup = {
  groupId: number;
  groupKey: string;
  displayName: string;
  description?: string | null;
  sourceType: DirectorySource;
  status: DirectoryStatus;
  memberCount: number;
  revision: number;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type DirectoryMember = {
  userId: number;
  displayName: string;
  email?: string | null;
  status: DirectoryStatus;
  primaryOrgUnitId?: number | null;
  primaryOrgName?: string | null;
};

export type OrganizationUnitDetail = {
  organization: OrganizationUnit;
  members: DirectoryMember[];
};

export type DirectoryGroupDetail = {
  group: DirectoryGroup;
  members: DirectoryMember[];
};

export type CreateOrganizationUnitRequest = {
  orgKey: string;
  name: string;
  description?: string;
  parentOrgUnitId?: number;
};

export type UpdateOrganizationUnitRequest = {
  name: string;
  description?: string;
  parentOrgUnitId?: number;
  version: number;
};

export type CreateDirectoryGroupRequest = {
  groupKey: string;
  displayName: string;
  description?: string;
};

export type UpdateDirectoryGroupRequest = {
  displayName: string;
  description?: string;
  version: number;
};

function searchParams(query: string, status: DirectoryStatus | 'ALL', page: number, size: number) {
  const search = new URLSearchParams({ page: String(page), size: String(size), status });
  if (query.trim()) search.set('query', query.trim());
  return search;
}

export async function listDirectoryUsers(
  query = '',
  page = 0,
  size = 100
): Promise<PageResult<DirectoryMember>> {
  const search = new URLSearchParams({ page: String(page), size: String(size), status: 'ACTIVE' });
  if (query.trim()) search.set('query', query.trim());
  const response = await axiosInstance.get<ApiResponse<PageResult<DirectoryMember>>>(
    `/api/auth/admin/directory/users?${search.toString()}`
  );
  return response.data.data;
}

export async function listOrganizationUnits(
  query = '',
  status: DirectoryStatus | 'ALL' = 'ALL',
  page = 0,
  size = 50
): Promise<PageResult<OrganizationUnit>> {
  const response = await axiosInstance.get<ApiResponse<PageResult<OrganizationUnit>>>(
    `/api/auth/admin/directory/organizations?${searchParams(query, status, page, size).toString()}`
  );
  return response.data.data;
}

export async function getOrganizationUnit(orgUnitId: number): Promise<OrganizationUnitDetail> {
  const response = await axiosInstance.get<ApiResponse<OrganizationUnitDetail>>(
    `/api/auth/admin/directory/organizations/${orgUnitId}`
  );
  return response.data.data;
}

export async function createOrganizationUnit(
  request: CreateOrganizationUnitRequest
): Promise<OrganizationUnit> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationUnit>,
    CreateOrganizationUnitRequest
  >('/api/auth/admin/directory/organizations', request);
  return response.data.data;
}

export async function updateOrganizationUnit(
  orgUnitId: number,
  request: UpdateOrganizationUnitRequest
): Promise<OrganizationUnit> {
  const response = await axiosInstance.patch<
    ApiResponse<OrganizationUnit>,
    UpdateOrganizationUnitRequest
  >(`/api/auth/admin/directory/organizations/${orgUnitId}`, request);
  return response.data.data;
}

export async function changeOrganizationUnitStatus(
  organization: OrganizationUnit,
  status: DirectoryStatus
): Promise<OrganizationUnit> {
  const action = status === 'ACTIVE' ? 'activate' : 'deactivate';
  const response = await axiosInstance.post<ApiResponse<OrganizationUnit>, { version: number }>(
    `/api/auth/admin/directory/organizations/${organization.orgUnitId}/${action}`,
    { version: organization.version }
  );
  return response.data.data;
}

export async function replaceOrganizationUnitMembers(
  organization: OrganizationUnit,
  userIds: number[]
): Promise<OrganizationUnitDetail> {
  const response = await axiosInstance.put<
    ApiResponse<OrganizationUnitDetail>,
    { userIds: number[]; version: number }
  >(`/api/auth/admin/directory/organizations/${organization.orgUnitId}/members`, {
    userIds,
    version: organization.version,
  });
  return response.data.data;
}

export async function listDirectoryGroups(
  query = '',
  status: DirectoryStatus | 'ALL' = 'ALL',
  page = 0,
  size = 50
): Promise<PageResult<DirectoryGroup>> {
  const response = await axiosInstance.get<ApiResponse<PageResult<DirectoryGroup>>>(
    `/api/auth/admin/directory/groups?${searchParams(query, status, page, size).toString()}`
  );
  return response.data.data;
}

export async function getDirectoryGroup(groupId: number): Promise<DirectoryGroupDetail> {
  const response = await axiosInstance.get<ApiResponse<DirectoryGroupDetail>>(
    `/api/auth/admin/directory/groups/${groupId}`
  );
  return response.data.data;
}

export async function createDirectoryGroup(
  request: CreateDirectoryGroupRequest
): Promise<DirectoryGroup> {
  const response = await axiosInstance.post<
    ApiResponse<DirectoryGroup>,
    CreateDirectoryGroupRequest
  >('/api/auth/admin/directory/groups', request);
  return response.data.data;
}

export async function updateDirectoryGroup(
  groupId: number,
  request: UpdateDirectoryGroupRequest
): Promise<DirectoryGroup> {
  const response = await axiosInstance.patch<
    ApiResponse<DirectoryGroup>,
    UpdateDirectoryGroupRequest
  >(`/api/auth/admin/directory/groups/${groupId}`, request);
  return response.data.data;
}

export async function changeDirectoryGroupStatus(
  group: DirectoryGroup,
  status: DirectoryStatus
): Promise<DirectoryGroup> {
  const action = status === 'ACTIVE' ? 'activate' : 'deactivate';
  const response = await axiosInstance.post<ApiResponse<DirectoryGroup>, { version: number }>(
    `/api/auth/admin/directory/groups/${group.groupId}/${action}`,
    { version: group.version }
  );
  return response.data.data;
}

export async function replaceDirectoryGroupMembers(
  group: DirectoryGroup,
  userIds: number[]
): Promise<DirectoryGroupDetail> {
  const response = await axiosInstance.put<
    ApiResponse<DirectoryGroupDetail>,
    { userIds: number[]; version: number }
  >(`/api/auth/admin/directory/groups/${group.groupId}/members`, {
    userIds,
    version: group.version,
  });
  return response.data.data;
}
