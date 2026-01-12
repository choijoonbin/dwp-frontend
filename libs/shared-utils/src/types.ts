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
  timestamp: string;
}

