// ----------------------------------------------------------------------

import type { CodeUsageSummary } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * TableState: 조회/필터 상태
 */
export type CodeUsageTableState = {
  keyword: string;
  selectedResourceKey: string;
};

/**
 * EditorState: 생성/수정 모달 상태
 */
export type CodeUsageFormState = {
  resourceKey: string;
  codeGroupKey: string;
  enabled: boolean;
};

export type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};
