type ApiStatus = 'SUCCESS' | 'OK' | 'FAIL' | 'ERROR' | (string & {});

export interface ApiResponse<T> {
  status: ApiStatus;
  message: string;
  data: T;
  timestamp?: string;
  errorCode?: string;
  correlationId?: string;
}
