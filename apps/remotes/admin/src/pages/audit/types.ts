// ----------------------------------------------------------------------

/**
 * TableState: 조회/필터 상태
 */
export type AuditLogTableState = {
  from: string;
  to: string;
  actor: string;
  action: string;
  keyword: string;
};

export type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};
