// ----------------------------------------------------------------------

import { HttpError } from '../http-error';

// Re-export HttpError for convenience
export { HttpError };

// ----------------------------------------------------------------------

/**
 * API Error Type Classification
 */
export type ApiErrorType = 'UNAUTHORIZED' | 'FORBIDDEN' | 'CONFLICT' | 'SERVER_ERROR' | 'UNKNOWN';

/**
 * Classify error by HTTP status code
 */
export const classifyApiError = (error: unknown): ApiErrorType => {
  if (error instanceof HttpError) {
    const status = error.status;
    if (status === 401) {
      return 'UNAUTHORIZED';
    }
    if (status === 403) {
      return 'FORBIDDEN';
    }
    if (status === 409) {
      return 'CONFLICT';
    }
    if (status >= 500) {
      return 'SERVER_ERROR';
    }
  }
  return 'UNKNOWN';
};

/**
 * Get user-friendly error message by error type
 */
export const getApiErrorMessage = (errorType: ApiErrorType, error?: unknown): string => {
  switch (errorType) {
    case 'UNAUTHORIZED':
      return '세션이 만료되었습니다. 다시 로그인해주세요.';
    case 'FORBIDDEN':
      return '접근 권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.';
    case 'CONFLICT':
      // Try to extract message from error if available
      if (error instanceof HttpError && error.message) {
        return error.message;
      }
      return '중복된 사용자 또는 계정입니다. 다른 이름이나 이메일을 사용해주세요.';
    case 'SERVER_ERROR':
      return '일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    default:
      return '요청 처리 중 오류가 발생했습니다.';
  }
};

/**
 * Check if error is retryable (500 errors)
 */
export const isRetryableError = (error: unknown): boolean =>
  classifyApiError(error) === 'SERVER_ERROR';

/**
 * Props for ApiErrorDisplay component
 */
export type ApiErrorDisplayProps = {
  error: unknown;
  onRetry?: () => void;
  severity?: 'error' | 'warning' | 'info';
};

/**
 * Get error display props for Alert component
 */
export const getApiErrorDisplayProps = (error: unknown): {
  severity: 'error' | 'warning' | 'info';
  message: string;
  showRetry: boolean;
} => {
  const errorType = classifyApiError(error);
  const message = getApiErrorMessage(errorType, error);
  
  return {
    severity: errorType === 'FORBIDDEN' ? 'warning' : 'error',
    message,
    showRetry: isRetryableError(error),
  };
};
