// ----------------------------------------------------------------------

import type { RoleSummary, ResourceNode } from '@dwp-frontend/shared-utils';

// Re-export RoleSummary for use in hooks
export type { RoleSummary };

// ----------------------------------------------------------------------

export type RoleDetailViewProps = {
  roleId: string;
  onEdit: (role: RoleSummary) => void;
  onDelete: (role: RoleSummary) => void;
  onSuccess: () => void;
};

export type RoleMembersSectionProps = {
  roleId: string;
  onSuccess: () => void;
};

export type RolePermissionsSectionProps = {
  roleId: string;
  onSuccess: () => void;
};

export type RolePermissionsMatrixProps = {
  roleId: string;
  onSuccess: () => void;
};

export type ResourceTreeViewProps = {
  nodes: ResourceNode[];
  permissionMap: Map<string, Set<string>>;
  permissionCodes: Array<{ value: string; label: string }>;
  roleId: string;
  onSuccess: () => void;
};

export type ResourceTreeNodeProps = {
  node: ResourceNode;
  permissionMap: Map<string, Set<string>>;
  permissionCodes: Array<{ value: string; label: string }>;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  roleId: string;
  onSuccess: () => void;
};

export type PermissionCheckboxProps = {
  resourceKey: string;
  permissionCode: string;
  roleId: string;
  checked: boolean;
  permissionMap: Map<string, Set<string>>;
  onSuccess: () => void;
  label: string;
};

export type RolePermissionsDialogProps = {
  open: boolean;
  onClose: () => void;
  roleId: string;
  onSuccess: () => void;
};

export type RowActionMenuProps = {
  resource: ResourceNode;
  permissionCodes: Array<{ value: string; label: string }>;
  resourcesTree?: ResourceNode[] | null;
  onRowApply: (resourceKey: string, effect: 'ALLOW' | 'DENY') => void;
  onSetPermission: (resourceKey: string, permissionCode: string, effect: 'ALLOW' | 'DENY' | 'NONE') => void;
  onApplyToChildren?: (resourceKey: string, permissionCodes: string[], effect: 'ALLOW' | 'DENY') => void;
};

export type RoleDialogProps = {
  open: boolean;
  onClose: () => void;
  role: RoleSummary | null;
  onSuccess: () => void;
};

export type DeleteConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onConfirm: () => void;
};

export type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

/**
 * TableState: 조회/목록/선택 상태
 */
export type RoleTableState = {
  keyword: string;
  selectedRoleId: string | null;
  // Future: filters, sort, page, size, rowSelection, expandedRowIds
};

/**
 * EditorState: 생성/수정/보기 모달 상태
 */
export type RoleFormState = {
  roleName: string;
  roleCode: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
};

export type RoleEditorState = {
  mode: 'create' | 'edit' | 'view';
  open: boolean;
  draftForm: RoleFormState;
  dirty: boolean;
  validationErrors: Record<string, string>;
  snackbar: SnackbarState;
};

/**
 * UI Models (for components)
 */
export type RoleRowModel = {
  id: string;
  roleName: string;
  roleCode: string;
  status: 'ACTIVE' | 'INACTIVE';
  statusLabel: string;
  statusColor: 'success' | 'default';
  memberCount?: number;
  departmentCount?: number;
  updatedAt?: string | null;
};

export type RoleDetailModel = {
  id: string;
  roleName: string;
  roleCode: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  statusLabel: string;
  statusColor: 'success' | 'default';
  createdAt: string;
  updatedAt?: string | null;
};

/**
 * Detail Panel Tab State
 */
export type RoleDetailTab = 'overview' | 'members' | 'permissions';

/**
 * Members State
 */
export type RoleMembersState = {
  selectedUserIds: Set<string>;
  dialogOpen: boolean;
  errorSnackbar: { open: boolean; message: string };
};

/**
 * Permissions State (Dirty state tracking)
 */
export type RolePermissionsState = {
  dirty: boolean;
  searchKeyword: string;
  resourceTypeFilter: string;
  onlyChanged: boolean;
  expandedNodes: Set<string>;
};
