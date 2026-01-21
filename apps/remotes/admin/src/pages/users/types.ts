// ----------------------------------------------------------------------

import type { UserSummary, UserDetail, UserAccount } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * UI Models (for components)
 */
export type UserRowModel = {
  id: string;
  userName: string;
  email: string | null;
  departmentName: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  statusLabel: string;
  statusColor: 'success' | 'default';
  createdAt: string;
  lastLoginAt: string | null;
  loginType: string | null; // From accounts
};

export type UserDetailModel = {
  id: string;
  userName: string;
  email: string | null;
  departmentId: string | null;
  departmentName: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  statusLabel: string;
  statusColor: 'success' | 'default';
  createdAt: string;
  lastLoginAt: string | null;
  accounts: UserAccount[];
};

/**
 * TableState: 조회/목록/선택 상태
 */
export type UserTableState = {
  keyword: string;
  statusFilter: string;
  loginTypeFilter: string;
  departmentFilter: string;
  roleFilter: string;
  page: number;
  rowsPerPage: number;
  selectedUserId: string | null;
};

/**
 * EditorState: 생성/수정/보기 모달 상태
 */
export type UserFormState = {
  userName: string;
  email: string;
  departmentId: string;
  status: 'ACTIVE' | 'INACTIVE';
  createLocalAccount: boolean;
  principal: string;
  password: string;
};

export type UserEditorState = {
  mode: 'create' | 'edit' | 'view';
  open: boolean;
  draftForm: UserFormState;
  dirty: boolean;
  validationErrors: Record<string, string>;
  selectedUser: UserSummary | null;
};

export type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};
