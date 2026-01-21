// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * UI Models
 */
export type ResourceRowModel = {
  id: string;
  resourceName: string;
  resourceKey: string;
  resourceType: string;
  path: string | null;
  parentId: string | null;
  sortOrder: number | null;
  enabled: boolean;
  trackingEnabled: boolean;
  eventActions: string[];
  children?: ResourceRowModel[];
};

/**
 * TableState: 조회/필터 상태
 */
export type ResourceTableState = {
  keyword: string;
  resourceTypeFilter: string;
  expandedNodes: Set<string>;
};

/**
 * EditorState: 생성/수정 모달 상태
 */
export type ResourceFormState = {
  resourceName: string;
  resourceKey: string;
  resourceType: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
  resourceCategory?: string;
  resourceKind?: string;
  path: string;
  parentId: string;
  sortOrder: string;
  enabled: boolean;
  trackingEnabled: boolean;
  eventActions: string[];
};

export type ResourceEditorState = {
  mode: 'create' | 'edit';
  open: boolean;
  draftForm: ResourceFormState;
  dirty: boolean;
  validationErrors: Record<string, string>;
  selectedResource: ResourceNode | null;
};

export type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};
