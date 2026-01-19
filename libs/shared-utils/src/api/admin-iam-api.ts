import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  PageResponse,
  UserSummary,
  UserDetail,
  UserCreatePayload,
  UserUpdatePayload,
  UserListParams,
  RoleSummary,
  RoleDetail,
  RoleCreatePayload,
  RoleUpdatePayload,
  RoleListParams,
  RoleMemberAssignmentPayload,
  RolePermissionAssignmentPayload,
  ResourceSummary,
  ResourceNode,
  ResourceCreatePayload,
  ResourceUpdatePayload,
  ResourceListParams,
  CodeGroup,
  Code,
  CodeGroupCreatePayload,
  CodeGroupUpdatePayload,
  CodeCreatePayload,
  CodeUpdatePayload,
  ResetPasswordPayload,
} from '../admin/types';

// ----------------------------------------------------------------------

// ============================================================================
// Users API
// ============================================================================

/**
 * Get admin users list
 * GET /api/admin/users
 */
export const getAdminUsers = async (
  params?: UserListParams
): Promise<ApiResponse<PageResponse<UserSummary>>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
  if (params?.status) queryParams.append('status', params.status);

  const url = `/api/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<PageResponse<UserSummary>>>(url);
  return res.data;
};

/**
 * Get admin user detail
 * GET /api/admin/users/:userId
 */
export const getAdminUserDetail = async (userId: string): Promise<ApiResponse<UserDetail>> => {
  const res = await axiosInstance.get<ApiResponse<UserDetail>>(`/api/admin/users/${userId}`);
  return res.data;
};

/**
 * Create admin user
 * POST /api/admin/users
 */
export const createAdminUser = async (payload: UserCreatePayload): Promise<ApiResponse<UserDetail>> => {
  const res = await axiosInstance.post<ApiResponse<UserDetail>>('/api/admin/users', payload);
  return res.data;
};

/**
 * Update admin user
 * PUT /api/admin/users/:userId
 */
export const updateAdminUser = async (
  userId: string,
  payload: UserUpdatePayload
): Promise<ApiResponse<UserDetail>> => {
  const res = await axiosInstance.post<ApiResponse<UserDetail>>(`/api/admin/users/${userId}`, payload);
  return res.data;
};

/**
 * Delete admin user
 * DELETE /api/admin/users/:userId
 */
export const deleteAdminUser = async (userId: string): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(`/api/admin/users/${userId}/delete`, {});
  return res.data;
};

/**
 * Reset admin user password
 * POST /api/admin/users/:userId/reset-password
 */
export const resetAdminUserPassword = async (
  userId: string,
  payload?: ResetPasswordPayload
): Promise<ApiResponse<{ temporaryPassword?: string; success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ temporaryPassword?: string; success: boolean }>>(
    `/api/admin/users/${userId}/reset-password`,
    payload || {}
  );
  return res.data;
};

/**
 * Get admin user roles
 * GET /api/admin/users/:userId/roles
 */
export const getAdminUserRoles = async (userId: string): Promise<ApiResponse<RoleSummary[]>> => {
  const res = await axiosInstance.get<ApiResponse<RoleSummary[]>>(`/api/admin/users/${userId}/roles`);
  return res.data;
};

/**
 * Update admin user roles
 * PUT /api/admin/users/:userId/roles
 */
export const updateAdminUserRoles = async (
  userId: string,
  roleIds: string[]
): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(`/api/admin/users/${userId}/roles`, {
    roleIds,
  });
  return res.data;
};

// ============================================================================
// Roles API
// ============================================================================

/**
 * Get admin roles list
 * GET /api/admin/roles
 */
export const getAdminRoles = async (
  params?: RoleListParams
): Promise<ApiResponse<PageResponse<RoleSummary>>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.status) queryParams.append('status', params.status);

  const url = `/api/admin/roles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<PageResponse<RoleSummary>>>(url);
  return res.data;
};

/**
 * Get admin role detail
 * GET /api/admin/roles/:roleId
 */
export const getAdminRoleDetail = async (roleId: string): Promise<ApiResponse<RoleDetail>> => {
  const res = await axiosInstance.get<ApiResponse<RoleDetail>>(`/api/admin/roles/${roleId}`);
  return res.data;
};

/**
 * Create admin role
 * POST /api/admin/roles
 */
export const createAdminRole = async (payload: RoleCreatePayload): Promise<ApiResponse<RoleDetail>> => {
  const res = await axiosInstance.post<ApiResponse<RoleDetail>>('/api/admin/roles', payload);
  return res.data;
};

/**
 * Update admin role
 * PUT /api/admin/roles/:roleId
 */
export const updateAdminRole = async (
  roleId: string,
  payload: RoleUpdatePayload
): Promise<ApiResponse<RoleDetail>> => {
  const res = await axiosInstance.post<ApiResponse<RoleDetail>>(`/api/admin/roles/${roleId}`, payload);
  return res.data;
};

/**
 * Delete admin role
 * DELETE /api/admin/roles/:roleId
 */
export const deleteAdminRole = async (roleId: string): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(`/api/admin/roles/${roleId}/delete`, {});
  return res.data;
};

/**
 * Get admin role members
 * GET /api/admin/roles/:roleId/members
 */
export const getAdminRoleMembers = async (roleId: string): Promise<ApiResponse<UserSummary[]>> => {
  const res = await axiosInstance.get<ApiResponse<UserSummary[]>>(`/api/admin/roles/${roleId}/members`);
  return res.data;
};

/**
 * Update admin role members
 * PUT /api/admin/roles/:roleId/members
 */
export const updateAdminRoleMembers = async (
  roleId: string,
  payload: RoleMemberAssignmentPayload
): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(
    `/api/admin/roles/${roleId}/members`,
    payload
  );
  return res.data;
};

/**
 * Get admin role permissions
 * GET /api/admin/roles/:roleId/permissions
 */
export const getAdminRolePermissions = async (
  roleId: string
): Promise<ApiResponse<RolePermissionAssignmentPayload>> => {
  const res = await axiosInstance.get<ApiResponse<RolePermissionAssignmentPayload>>(
    `/api/admin/roles/${roleId}/permissions`
  );
  return res.data;
};

/**
 * Update admin role permissions
 * PUT /api/admin/roles/:roleId/permissions
 */
export const updateAdminRolePermissions = async (
  roleId: string,
  payload: RolePermissionAssignmentPayload
): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(
    `/api/admin/roles/${roleId}/permissions`,
    payload
  );
  return res.data;
};

// ============================================================================
// Resources API
// ============================================================================

/**
 * Get admin resources list
 * GET /api/admin/resources
 */
export const getAdminResources = async (
  params?: ResourceListParams
): Promise<ApiResponse<PageResponse<ResourceSummary>>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.resourceType) queryParams.append('resourceType', params.resourceType);

  const url = `/api/admin/resources${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<PageResponse<ResourceSummary>>>(url);
  return res.data;
};

/**
 * Get admin resources tree
 * GET /api/admin/resources/tree
 */
export const getAdminResourcesTree = async (): Promise<ApiResponse<ResourceNode[]>> => {
  const res = await axiosInstance.get<ApiResponse<ResourceNode[]>>('/api/admin/resources/tree');
  return res.data;
};

/**
 * Get admin resource detail
 * GET /api/admin/resources/:resourceId
 */
export const getAdminResourceDetail = async (resourceId: string): Promise<ApiResponse<ResourceSummary>> => {
  const res = await axiosInstance.get<ApiResponse<ResourceSummary>>(`/api/admin/resources/${resourceId}`);
  return res.data;
};

/**
 * Create admin resource
 * POST /api/admin/resources
 */
export const createAdminResource = async (
  payload: ResourceCreatePayload
): Promise<ApiResponse<ResourceSummary>> => {
  const res = await axiosInstance.post<ApiResponse<ResourceSummary>>('/api/admin/resources', payload);
  return res.data;
};

/**
 * Update admin resource
 * PUT /api/admin/resources/:resourceId
 */
export const updateAdminResource = async (
  resourceId: string,
  payload: ResourceUpdatePayload
): Promise<ApiResponse<ResourceSummary>> => {
  const res = await axiosInstance.post<ApiResponse<ResourceSummary>>(`/api/admin/resources/${resourceId}`, payload);
  return res.data;
};

/**
 * Delete admin resource
 * DELETE /api/admin/resources/:resourceId
 */
export const deleteAdminResource = async (resourceId: string): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(
    `/api/admin/resources/${resourceId}/delete`,
    {}
  );
  return res.data;
};

// ============================================================================
// Codes API
// ============================================================================

/**
 * Get code groups
 * GET /api/admin/codes/groups
 */
export const getCodeGroups = async (): Promise<ApiResponse<CodeGroup[]>> => {
  const res = await axiosInstance.get<ApiResponse<CodeGroup[]>>('/api/admin/codes/groups');
  return res.data;
};

/**
 * Get codes by group
 * GET /api/admin/codes/:groupKey
 */
export const getCodesByGroup = async (groupKey: string): Promise<ApiResponse<Code[]>> => {
  const res = await axiosInstance.get<ApiResponse<Code[]>>(`/api/admin/codes/${groupKey}`);
  return res.data;
};

/**
 * Get all codes
 * GET /api/admin/codes
 */
export const getAllCodes = async (): Promise<ApiResponse<Code[]>> => {
  const res = await axiosInstance.get<ApiResponse<Code[]>>('/api/admin/codes');
  return res.data;
};

/**
 * Create code group
 * POST /api/admin/codes/groups
 */
export const createCodeGroup = async (payload: CodeGroupCreatePayload): Promise<ApiResponse<CodeGroup>> => {
  const res = await axiosInstance.post<ApiResponse<CodeGroup>>('/api/admin/codes/groups', payload);
  return res.data;
};

/**
 * Update code group
 * PUT /api/admin/codes/groups/:groupId
 */
export const updateCodeGroup = async (
  groupId: string,
  payload: CodeGroupUpdatePayload
): Promise<ApiResponse<CodeGroup>> => {
  const res = await axiosInstance.post<ApiResponse<CodeGroup>>(`/api/admin/codes/groups/${groupId}`, payload);
  return res.data;
};

/**
 * Delete code group
 * DELETE /api/admin/codes/groups/:groupId
 */
export const deleteCodeGroup = async (groupId: string): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(
    `/api/admin/codes/groups/${groupId}/delete`,
    {}
  );
  return res.data;
};

/**
 * Create code
 * POST /api/admin/codes
 */
export const createCode = async (payload: CodeCreatePayload): Promise<ApiResponse<Code>> => {
  const res = await axiosInstance.post<ApiResponse<Code>>('/api/admin/codes', payload);
  return res.data;
};

/**
 * Update code
 * PUT /api/admin/codes/:codeId
 */
export const updateCode = async (codeId: string, payload: CodeUpdatePayload): Promise<ApiResponse<Code>> => {
  const res = await axiosInstance.post<ApiResponse<Code>>(`/api/admin/codes/${codeId}`, payload);
  return res.data;
};

/**
 * Delete code
 * DELETE /api/admin/codes/:codeId
 */
export const deleteCode = async (codeId: string): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(`/api/admin/codes/${codeId}/delete`, {});
  return res.data;
};
