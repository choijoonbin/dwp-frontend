// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * TableState: 조회/필터 상태
 */
export type MenuTableState = {
  expandedNodes: Set<string>;
};

/**
 * EditorState: 생성/수정 모달 상태
 */
export type MenuFormState = {
  menuKey: string;
  menuName: string;
  path: string;
  icon: string;
  group: string;
  parentId: string;
  sortOrder: string;
  enabled: boolean;
};

export type MenuEditorState = {
  mode: 'create' | 'edit';
  open: boolean;
  draftForm: MenuFormState;
  dirty: boolean;
  validationErrors: Record<string, string>;
  selectedMenu: AdminMenuNode | null;
};

export type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};
