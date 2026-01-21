import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  Code,
  CodeGroup,
  UserDetail,
  RoleDetail,
  UserSummary,
  RoleSummary,
  PageResponse,
  ResourceNode,
  AdminMenuNode,
  UserListParams,
  RoleListParams,
  CodeListParams,
  AuditLogDetail,
  RoleMemberView,
  ResourceSummary,
  AuditLogSummary,
  UserCreatePayload,
  UserUpdatePayload,
  RoleCreatePayload,
  RoleUpdatePayload,
  MenuCreatePayload,
  MenuUpdatePayload,
  CodeCreatePayload,
  CodeUpdatePayload,
  ResourceListParams,
  MenuReorderPayload,
  AuditLogListParams,
  CodeGroupListParams,
  ResetPasswordPayload,
  ResourceCreatePayload,
  ResourceUpdatePayload,
  RolePermissionResponse,
  CodeGroupCreatePayload,
  CodeGroupUpdatePayload,
  RoleMemberAssignmentPayload,
  RolePermissionAssignmentPayload,
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
  const res = await axiosInstance.put<ApiResponse<UserDetail>>(`/api/admin/users/${userId}`, payload);
  return res.data;
};

/**
 * Disable admin user (soft delete)
 * PUT /api/admin/users/:userId/disable
 */
export const disableAdminUser = async (userId: string): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.put<ApiResponse<{ success: boolean }>>(`/api/admin/users/${userId}/disable`, {});
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
  payload: { roleIds: string[]; replace?: boolean }
): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.put<ApiResponse<{ success: boolean }>>(`/api/admin/users/${userId}/roles`, {
    roleIds: payload.roleIds,
    replace: payload.replace ?? true, // Default to replace mode
  });
  return res.data;
};

// ============================================================================
// Roles API
// ============================================================================

/**
 * Backend role response structure
 * Backend returns: { id (string), roleCode, roleName, description, createdAt, status, memberCount, userCount, departmentCount }
 */
type BackendRoleSummary = {
  id: string; // 백엔드가 문자열로 반환
  roleCode: string;
  roleName: string;
  description?: string | null;
  createdAt: string;
  status: 'ACTIVE' | 'INACTIVE';
  memberCount?: number;
  userCount?: number;
  departmentCount?: number;
};

/**
 * Backend role detail response structure
 */
type BackendRoleDetail = {
  id: string; // 백엔드가 문자열로 반환
  roleCode: string;
  roleName: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string | null;
  memberCount?: number;
  userCount?: number;
  departmentCount?: number;
};

/**
 * Convert backend role response to frontend RoleSummary
 */
const toRoleSummary = (backend: BackendRoleSummary): RoleSummary => ({
  id: backend.id,
  roleName: backend.roleName,
  roleCode: backend.roleCode,
  description: backend.description,
  status: backend.status,
  createdAt: backend.createdAt,
  memberCount: backend.memberCount,
  userCount: backend.userCount,
  departmentCount: backend.departmentCount,
});

/**
 * Convert backend role detail response to frontend RoleDetail
 */
const toRoleDetail = (backend: BackendRoleDetail): RoleDetail => ({
  id: backend.id,
  roleName: backend.roleName,
  roleCode: backend.roleCode,
  description: backend.description,
  status: backend.status,
  createdAt: backend.createdAt,
  updatedAt: backend.updatedAt || null,
  memberCount: backend.memberCount,
  userCount: backend.userCount,
  departmentCount: backend.departmentCount,
});

/**
 * Get admin roles list
 * GET /api/admin/roles
 * 
 * Backend returns: { comRoleId, roleCode, roleName, ... }
 * Converts to frontend format: { id, roleCode, roleName, ... }
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
  const res = await axiosInstance.get<ApiResponse<PageResponse<BackendRoleSummary>>>(url);
  
  // Convert backend response to frontend format
  // res.data is ApiResponse<PageResponse<BackendRoleSummary>>
  // res.data.data is PageResponse<BackendRoleSummary>
  if (res.data?.data?.items) {
    return {
      ...res.data,
      data: {
        ...res.data.data,
        items: res.data.data.items.map(toRoleSummary),
      },
    };
  }
  
  return res.data as ApiResponse<PageResponse<RoleSummary>>;
};

/**
 * Get admin role detail
 * GET /api/admin/roles/:roleId
 * 
 * Backend returns: { comRoleId, roleCode, roleName, ... }
 * Converts to frontend format: { id, roleCode, roleName, ... }
 */
export const getAdminRoleDetail = async (roleId: string): Promise<ApiResponse<RoleDetail>> => {
  const res = await axiosInstance.get<ApiResponse<BackendRoleDetail>>(`/api/admin/roles/${roleId}`);
  
  // Convert backend response to frontend format
  // res.data is ApiResponse<BackendRoleDetail>
  // res.data.data is BackendRoleDetail
  if (res.data?.data) {
    return {
      ...res.data,
      data: toRoleDetail(res.data.data),
    };
  }
  
  return res.data as ApiResponse<RoleDetail>;
};

/**
 * Create admin role
 * POST /api/admin/roles
 * 
 * Backend returns: { comRoleId, roleCode, roleName, ... }
 * Converts to frontend format: { id, roleCode, roleName, ... }
 */
export const createAdminRole = async (payload: RoleCreatePayload): Promise<ApiResponse<RoleDetail>> => {
  const res = await axiosInstance.post<ApiResponse<BackendRoleDetail>>('/api/admin/roles', payload);
  
  // Convert backend response to frontend format
  // res.data is ApiResponse<BackendRoleDetail>
  // res.data.data is BackendRoleDetail
  if (res.data?.data) {
    return {
      ...res.data,
      data: toRoleDetail(res.data.data),
    };
  }
  
  return res.data as ApiResponse<RoleDetail>;
};

/**
 * Update admin role
 * PUT /api/admin/roles/:roleId
 * 
 * Backend returns: { comRoleId, roleCode, roleName, ... }
 * Converts to frontend format: { id, roleCode, roleName, ... }
 */
export const updateAdminRole = async (
  roleId: string,
  payload: RoleUpdatePayload
): Promise<ApiResponse<RoleDetail>> => {
  const res = await axiosInstance.put<ApiResponse<BackendRoleDetail>>(`/api/admin/roles/${roleId}`, payload);
  
  // Convert backend response to frontend format
  // res.data is ApiResponse<BackendRoleDetail>
  // res.data.data is BackendRoleDetail
  if (res.data?.data) {
    return {
      ...res.data,
      data: toRoleDetail(res.data.data),
    };
  }
  
  return res.data as ApiResponse<RoleDetail>;
};

/**
 * Disable admin role (soft delete)
 * PUT /api/admin/roles/:roleId/disable
 */
export const disableAdminRole = async (roleId: string): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.put<ApiResponse<{ success: boolean }>>(`/api/admin/roles/${roleId}/disable`, {});
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
 * Backend role member response structure
 */
type BackendRoleMemberView = {
  id: string;
  subjectType: 'USER' | 'DEPARTMENT';
  subjectName: string;
  subjectCode?: string | null;
  subjectEmail?: string | null;
  departmentName?: string | null;
};

/**
 * Convert backend role member to frontend RoleMemberView
 */
const toRoleMemberView = (backend: BackendRoleMemberView): RoleMemberView => ({
  id: backend.id,
  subjectType: backend.subjectType,
  subjectName: backend.subjectName,
  subjectCode: backend.subjectCode,
  subjectEmail: backend.subjectEmail,
  departmentName: backend.departmentName,
});

/**
 * Get admin role members
 * GET /api/admin/roles/:roleId/members
 * 
 * Backend returns: RoleMemberView[]
 * Converts to frontend format: RoleMemberView[]
 */
export const getAdminRoleMembers = async (roleId: string): Promise<ApiResponse<RoleMemberView[]>> => {
  const res = await axiosInstance.get<ApiResponse<BackendRoleMemberView[]>>(`/api/admin/roles/${roleId}/members`);
  
  // Convert backend response to frontend format
  if (res.data?.data) {
    return {
      ...res.data,
      data: res.data.data.map(toRoleMemberView),
    };
  }
  
  return res.data as ApiResponse<RoleMemberView[]>;
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
): Promise<ApiResponse<RolePermissionResponse>> => {
  const res = await axiosInstance.get<ApiResponse<RolePermissionResponse>>(
    `/api/admin/roles/${roleId}/permissions`
  );
  return res.data;
};

/**
 * Update admin role permissions (bulk)
 * PUT /api/admin/roles/:roleId/permissions
 */
export const updateAdminRolePermissions = async (
  roleId: string,
  payload: RolePermissionAssignmentPayload
): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.put<ApiResponse<{ success: boolean }>>(
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
// Menus API
// ============================================================================

/**
 * Get admin menus tree
 * GET /api/admin/menus/tree
 */
export const getAdminMenusTree = async (): Promise<ApiResponse<AdminMenuNode[]>> => {
  const res = await axiosInstance.get<ApiResponse<AdminMenuNode[]>>('/api/admin/menus/tree');
  return res.data;
};

/**
 * Create admin menu
 * POST /api/admin/menus
 */
export const createAdminMenu = async (payload: MenuCreatePayload): Promise<ApiResponse<AdminMenuNode>> => {
  const res = await axiosInstance.post<ApiResponse<AdminMenuNode>>('/api/admin/menus', payload);
  return res.data;
};

/**
 * Update admin menu
 * PUT /api/admin/menus/:menuId
 */
export const updateAdminMenu = async (
  menuId: string,
  payload: MenuUpdatePayload
): Promise<ApiResponse<AdminMenuNode>> => {
  const res = await axiosInstance.put<ApiResponse<AdminMenuNode>>(`/api/admin/menus/${menuId}`, payload);
  return res.data;
};

/**
 * Delete admin menu
 * DELETE /api/admin/menus/:menuId
 */
export const deleteAdminMenu = async (menuId: string): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(`/api/admin/menus/${menuId}/delete`, {});
  return res.data;
};

/**
 * Reorder admin menus
 * POST /api/admin/menus/reorder
 */
export const reorderAdminMenus = async (payload: MenuReorderPayload): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>('/api/admin/menus/reorder', payload);
  return res.data;
};

// ============================================================================
// Codes API
// ============================================================================

/**
 * Get admin code groups
 * GET /api/admin/codes/groups
 */
export const getAdminCodeGroups = async (params?: CodeGroupListParams): Promise<ApiResponse<CodeGroup[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.tenantScope && params.tenantScope !== 'ALL') queryParams.append('tenantScope', params.tenantScope);
  if (params?.enabled !== undefined) queryParams.append('enabled', params.enabled.toString());

  const url = `/api/admin/codes/groups${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<CodeGroup[]>>(url);
  return res.data;
};

/**
 * Get code groups (legacy, for backward compatibility)
 * GET /api/admin/codes/groups
 */
export const getCodeGroups = async (): Promise<ApiResponse<CodeGroup[]>> => getAdminCodeGroups();

/**
 * Get admin codes
 * GET /api/admin/codes
 */
export const getAdminCodes = async (params?: CodeListParams): Promise<ApiResponse<Code[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.tenantScope && params.tenantScope !== 'ALL') queryParams.append('tenantScope', params.tenantScope);
  if (params?.enabled !== undefined) queryParams.append('enabled', params.enabled.toString());

  const url = `/api/admin/codes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<Code[]>>(url);
  return res.data;
};

/**
 * Get codes by group
 * GET /api/admin/codes/:groupKey
 */
export const getCodesByGroup = async (groupKey: string, params?: CodeListParams): Promise<ApiResponse<Code[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.tenantScope && params.tenantScope !== 'ALL') queryParams.append('tenantScope', params.tenantScope);
  if (params?.enabled !== undefined) queryParams.append('enabled', params.enabled.toString());

  const url = `/api/admin/codes/${groupKey}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<Code[]>>(url);
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

// ============================================================================
// Audit Logs API
// ============================================================================

/**
 * Get admin audit logs
 * GET /api/admin/audit-logs
 */
export const getAdminAuditLogs = async (
  params?: AuditLogListParams
): Promise<ApiResponse<PageResponse<AuditLogSummary>>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.actor) queryParams.append('actor', params.actor);
  if (params?.action) queryParams.append('action', params.action);
  if (params?.keyword) queryParams.append('keyword', params.keyword);

  const url = `/api/admin/audit-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<PageResponse<AuditLogSummary>>>(url);
  return res.data;
};

/**
 * Get admin audit log detail
 * GET /api/admin/audit-logs/:id
 */
export const getAdminAuditLogDetail = async (id: string): Promise<ApiResponse<AuditLogDetail>> => {
  const res = await axiosInstance.get<ApiResponse<AuditLogDetail>>(`/api/admin/audit-logs/${id}`);
  return res.data;
};

/**
 * Export admin audit logs to Excel
 * GET /api/admin/audit-logs/export
 */
export const exportAdminAuditLogs = async (params?: AuditLogListParams): Promise<Blob> => {
  const queryParams = new URLSearchParams();
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.actor) queryParams.append('actor', params.actor);
  if (params?.action) queryParams.append('action', params.action);
  if (params?.keyword) queryParams.append('keyword', params.keyword);

  const url = `/api/admin/audit-logs/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<Blob>(url, {
    responseType: 'blob',
  });
  return res.data;
};
