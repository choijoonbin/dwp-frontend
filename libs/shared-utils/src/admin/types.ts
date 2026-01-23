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
  userCount?: number;
  departmentCount?: number;
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
  updatedAt?: string | null;
  memberCount?: number;
  userCount?: number;
  departmentCount?: number;
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
 * Role Member View (for UI display)
 */
export type RoleMemberView = {
  id: string;
  subjectType: 'USER' | 'DEPARTMENT';
  subjectName: string;
  subjectCode?: string | null;
  subjectEmail?: string | null;
  departmentName?: string | null;
};

/**
 * Role Permission Response (GET)
 * Backend returns: { permissions: [{ resourceKey, permissionCodes: string[], effect?, resourceSortOrder?, permissionSortOrder?, permissionDescription? }] }
 */
export type RolePermissionResponse = {
  permissions: {
    resourceKey: string;
    permissionCodes: string[]; // VIEW, USE, EDIT, DELETE, APPROVE, EXECUTE 등
    effect?: 'ALLOW' | 'DENY'; // Optional: effect type (default: ALLOW)
    resourceSortOrder?: number | null;
    permissionSortOrder?: number | null;
    permissionDescription?: string | null;
  }[];
};

/**
 * Role Permission Assignment Payload (PUT)
 * Backend expects: { items: [{ resourceKey, permissionCode, effect: "ALLOW"|"DENY"|null }] }
 */
export type RolePermissionAssignmentPayload = {
  items: {
    resourceKey: string;
    permissionCode: string; // VIEW, USE, EDIT, DELETE, APPROVE, EXECUTE 등
    effect: 'ALLOW' | 'DENY' | null; // null for NONE (deletion)
  }[];
};

/**
 * Resource Permission Row (for matrix display)
 */
export type ResourcePermissionRow = {
  resourceKey: string;
  resourceName: string;
  resourceType: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
  resourceKind?: string | null;
  parentId?: string | null;
  enabled: boolean;
  permissions: Record<string, 'ALLOW' | 'DENY' | 'NONE'>; // permissionCode -> effect
};

/**
 * Permission Matrix State (original vs current for dirty tracking)
 */
export type PermissionMatrixState = {
  original: Map<string, Map<string, 'ALLOW' | 'DENY' | 'NONE'>>; // resourceKey -> permissionCode -> effect
  current: Map<string, Map<string, 'ALLOW' | 'DENY' | 'NONE'>>; // resourceKey -> permissionCode -> effect
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
  resourceSortOrder?: number | null;
  permissions: {
    code: string;
    granted: boolean;
    permissionSortOrder?: number | null;
    permissionDescription?: string | null;
  }[];
};

/**
 * Resource Summary (for list view)
 * @see ROADMAP P1-8: BE 보완 예정 icon, status(enabled→ACTIVE/INACTIVE), description
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
  trackingEnabled?: boolean;
  eventActions?: string[];
  createdAt: string;
  /** BE P1-8 보완 예정 */
  icon?: string | null;
  description?: string | null;
  /** BE P1-8: enabled→ACTIVE/INACTIVE 매핑 시 사용 */
  status?: 'ACTIVE' | 'INACTIVE' | null;
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
  resourceCategory?: string | null;
  resourceKind?: string | null;
  path?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  enabled?: boolean;
  trackingEnabled?: boolean;
  eventActions?: string[];
};

export type ResourceUpdatePayload = {
  resourceName?: string;
  resourceKey?: string;
  resourceType?: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
  resourceCategory?: string | null;
  resourceKind?: string | null;
  path?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  enabled?: boolean;
  trackingEnabled?: boolean;
  eventActions?: string[];
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
  tenantScope?: 'COMMON' | 'TENANT';
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
  tenantScope?: 'COMMON' | 'TENANT';
  enabled: boolean;
  createdAt: string;
};

/**
 * Menu Node (for admin menu management)
 * @see ROADMAP P1-8: BE 보완 예정 permissionKey
 */
export type AdminMenuNode = {
  id: string;
  menuKey: string;
  menuName: string;
  path?: string | null;
  icon?: string | null;
  group?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  enabled?: boolean;
  children?: AdminMenuNode[];
  /** BE P1-8 보완 예정 (menuKey 또는 연동 리소스 키) */
  permissionKey?: string | null;
};

/**
 * Menu Create/Update Payload
 */
export type MenuCreatePayload = {
  menuKey: string;
  menuName: string;
  path?: string | null;
  icon?: string | null;
  group?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  enabled?: boolean;
};

export type MenuUpdatePayload = {
  menuName?: string;
  path?: string | null;
  icon?: string | null;
  group?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  enabled?: boolean;
};

/**
 * Menu Reorder Payload
 */
export type MenuReorderPayload = {
  menuId: string;
  direction: 'UP' | 'DOWN';
};

/**
 * Code Group Create/Update Payload
 */
export type CodeGroupCreatePayload = {
  groupKey: string;
  groupName: string;
  description?: string | null;
  tenantScope?: 'COMMON' | 'TENANT';
  enabled?: boolean;
};

export type CodeGroupUpdatePayload = {
  groupKey?: string;
  groupName?: string;
  description?: string | null;
  tenantScope?: 'COMMON' | 'TENANT';
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
  tenantScope?: 'COMMON' | 'TENANT';
  enabled?: boolean;
};

export type CodeUpdatePayload = {
  codeKey?: string;
  codeName?: string;
  codeValue?: string | null;
  description?: string | null;
  sortOrder?: number | null;
  tenantScope?: 'COMMON' | 'TENANT';
  enabled?: boolean;
};

/**
 * Code List Params
 */
export type CodeListParams = {
  keyword?: string;
  tenantScope?: 'COMMON' | 'TENANT' | 'ALL';
  enabled?: boolean;
};

/**
 * Code Group List Params
 */
export type CodeGroupListParams = {
  keyword?: string;
  tenantScope?: 'COMMON' | 'TENANT' | 'ALL';
  enabled?: boolean;
};

/**
 * Reset Password Payload
 */
export type ResetPasswordPayload = {
  newPassword?: string | null; // If provided, use this; otherwise generate temporary
};

/**
 * Code Usage Summary (for list view)
 */
export type CodeUsageSummary = {
  id: string;
  resourceKey: string;
  codeGroupKey: string;
  enabled: boolean;
  createdAt: string;
};

/**
 * Code Usage Detail (for detail/edit view)
 * @see ROADMAP P1-5: BE GET /{id} — createdBy, updatedBy는 Long(user id) 반환. FE 결과 5.2
 */
export type CodeUsageDetail = {
  id: string;
  resourceKey: string;
  codeGroupKey: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string | null;
  /** BE: Long(user id). 표시명 필요 시 FE에서 id→이름 조회 */
  createdBy?: string | number | null;
  updatedBy?: string | number | null;
};

/**
 * Code Usage Create/Update Payload
 */
export type CodeUsageCreatePayload = {
  resourceKey: string;
  codeGroupKey: string;
  enabled?: boolean;
};

export type CodeUsageUpdatePayload = {
  enabled?: boolean;
};

/**
 * Code Usage List Params
 */
export type CodeUsageListParams = {
  page?: number;
  size?: number;
  keyword?: string;
  resourceKey?: string;
  codeGroupKey?: string;
  enabled?: boolean;
};

/**
 * Audit Log Summary (for list view)
 */
export type AuditLogSummary = {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  occurredAt: string; // ISO 8601 date string
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Audit Log Detail (for detail view)
 * @see ROADMAP P1-4, FE 결과 5.1: actor/actorUserId(Long만 반환 가능), ipAddress 등 metadata_json 기반
 */
export type AuditLogDetail = {
  id: string;
  /** BE: string 또는 Long(actorUserId). 고려사항 5.1에서 actorUserId(Long)만 반환 가능 */
  actor?: string | number | null;
  /** BE: actorUserId만 제공 시 이 필드로 옴 */
  actorUserId?: number | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  occurredAt: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  /** BE: metadata_json에서 추출 (키: ip/ipAddress, userAgent/user_agent, before, after) */
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeValue?: string | null;
  afterValue?: string | null;
};

/**
 * Audit Log List Params
 * @see BE P1-9: Audit Export GET supports resourceType, maxRows
 */
export type AuditLogListParams = {
  page?: number;
  size?: number;
  from?: string; // ISO 8601 date string
  to?: string; // ISO 8601 date string
  actor?: string;
  action?: string;
  keyword?: string;
  resourceType?: string;
  maxRows?: number;
};
