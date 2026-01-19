// ----------------------------------------------------------------------

/**
 * Page Response (for paginated lists)
 */
export type PageResponse<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
};

/**
 * User Summary (for list view)
 */
export type UserSummary = {
  id: string;
  userName: string;
  email?: string | null;
  departmentName?: string | null;
  departmentId?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string; // ISO 8601 date string
  lastLoginAt?: string | null; // ISO 8601 date string
};

/**
 * User Detail (for detail/edit view)
 */
export type UserDetail = {
  id: string;
  userName: string;
  email?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  lastLoginAt?: string | null;
  accounts?: UserAccount[];
};

/**
 * User Account (for authentication)
 */
export type UserAccount = {
  id: string;
  accountType: 'LOCAL' | 'SSO' | 'LDAP';
  principal?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
};

/**
 * User Create/Update Payload
 */
export type UserCreatePayload = {
  userName: string;
  email?: string | null;
  departmentId?: string | null;
  createLocalAccount?: boolean;
  principal?: string | null;
  password?: string | null;
};

export type UserUpdatePayload = {
  userName?: string;
  email?: string | null;
  departmentId?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
};

/**
 * User List Params
 */
export type UserListParams = {
  page?: number;
  size?: number;
  keyword?: string;
  departmentId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
};

/**
 * Role Summary (for list view)
 */
export type RoleSummary = {
  id: string;
  roleName: string;
  roleCode: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  memberCount?: number;
};

/**
 * Role Detail (for detail/edit view)
 */
export type RoleDetail = {
  id: string;
  roleName: string;
  roleCode: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  memberCount?: number;
};

/**
 * Role Create/Update Payload
 */
export type RoleCreatePayload = {
  roleName: string;
  roleCode: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
};

export type RoleUpdatePayload = {
  roleName?: string;
  roleCode?: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
};

/**
 * Role List Params
 */
export type RoleListParams = {
  page?: number;
  size?: number;
  keyword?: string;
  status?: 'ACTIVE' | 'INACTIVE';
};

/**
 * Role Member Assignment Payload
 */
export type RoleMemberAssignmentPayload = {
  userIds: string[];
  departmentIds?: string[];
};

/**
 * Role Permission Assignment Payload
 */
export type RolePermissionAssignmentPayload = {
  permissions: {
    resourceKey: string;
    permissionCodes: string[]; // VIEW, USE, EDIT, DELETE, APPROVE, EXECUTE 등
  }[];
};

/**
 * Permission Summary
 */
export type PermissionSummary = {
  resourceKey: string;
  resourceName?: string | null;
  resourceType: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
  permissionCodes: string[]; // VIEW, USE, EDIT, DELETE, APPROVE, EXECUTE 등
};

/**
 * Role Permission View (for UI display)
 */
export type RolePermissionView = {
  resourceKey: string;
  resourceName?: string | null;
  resourceType: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
  path?: string | null;
  parentId?: string | null;
  permissions: {
    code: string;
    granted: boolean;
  }[];
};

/**
 * Resource Summary (for list view)
 */
export type ResourceSummary = {
  id: string;
  resourceName: string;
  resourceKey: string;
  resourceType: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
  path?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  enabled: boolean;
  createdAt: string;
};

/**
 * Resource Node (for tree view)
 */
export type ResourceNode = ResourceSummary & {
  children?: ResourceNode[];
};

/**
 * Resource Create/Update Payload
 */
export type ResourceCreatePayload = {
  resourceName: string;
  resourceKey: string;
  resourceType: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
  path?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  enabled?: boolean;
};

export type ResourceUpdatePayload = {
  resourceName?: string;
  resourceKey?: string;
  resourceType?: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
  path?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  enabled?: boolean;
};

/**
 * Resource List Params
 */
export type ResourceListParams = {
  page?: number;
  size?: number;
  keyword?: string;
  resourceType?: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
};

/**
 * Code Group
 */
export type CodeGroup = {
  id: string;
  groupKey: string;
  groupName: string;
  description?: string | null;
  enabled: boolean;
  createdAt: string;
};

/**
 * Code
 */
export type Code = {
  id: string;
  groupKey: string;
  codeKey: string;
  codeName: string;
  codeValue?: string | null;
  description?: string | null;
  sortOrder?: number | null;
  enabled: boolean;
  createdAt: string;
};

/**
 * Code Group Create/Update Payload
 */
export type CodeGroupCreatePayload = {
  groupKey: string;
  groupName: string;
  description?: string | null;
  enabled?: boolean;
};

export type CodeGroupUpdatePayload = {
  groupKey?: string;
  groupName?: string;
  description?: string | null;
  enabled?: boolean;
};

/**
 * Code Create/Update Payload
 */
export type CodeCreatePayload = {
  groupKey: string;
  codeKey: string;
  codeName: string;
  codeValue?: string | null;
  description?: string | null;
  sortOrder?: number | null;
  enabled?: boolean;
};

export type CodeUpdatePayload = {
  codeKey?: string;
  codeName?: string;
  codeValue?: string | null;
  description?: string | null;
  sortOrder?: number | null;
  enabled?: boolean;
};

/**
 * Reset Password Payload
 */
export type ResetPasswordPayload = {
  newPassword?: string | null; // If provided, use this; otherwise generate temporary
};
