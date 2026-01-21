// ----------------------------------------------------------------------

import type { CodeGroup, Code } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * TableState: 조회/필터 상태
 */
export type CodeGroupTableState = {
  keyword: string;
  tenantScope: 'COMMON' | 'TENANT' | 'ALL';
  enabled: boolean | undefined;
};

export type CodeTableState = {
  keyword: string;
  tenantScope: 'COMMON' | 'TENANT' | 'ALL';
  enabled: boolean | undefined;
};

/**
 * EditorState: 생성/수정 모달 상태
 */
export type CodeGroupFormState = {
  groupKey: string;
  groupName: string;
  description: string;
  tenantScope: 'COMMON' | 'TENANT';
  enabled: boolean;
};

export type CodeFormState = {
  codeKey: string;
  codeName: string;
  codeValue: string;
  description: string;
  sortOrder: string;
  tenantScope: 'COMMON' | 'TENANT';
  enabled: boolean;
};

export type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};
