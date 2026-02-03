// ----------------------------------------------------------------------

export type ApiStatus = 'SUCCESS' | 'FAIL' | 'ERROR' | (string & {});

/**
 * Backend common response envelope.
 * Example:
 * {
 *   "status": "SUCCESS",
 *   "message": "...",
 *   "data": <T>,
 *   "timestamp": "2026-01-12T10:19:47.119778"
 * }
 */
export interface ApiResponse<T> {
  status: ApiStatus;
  message: string;
  data: T;
  success?: boolean;
  timestamp: string;
  errorCode?: string;
  /** Action simulate/approve/execute 실패 시 BE가 포함 */
  auditId?: string;
  traceId?: string;
  gatewayRequestId?: string;
}

