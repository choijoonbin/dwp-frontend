// ----------------------------------------------------------------------

import { useCallback } from 'react';

import { classifyApiError, getApiErrorMessage } from '../api/api-error-handler';

// ----------------------------------------------------------------------

/**
 * Hook to handle mutation errors consistently
 * Returns a handler function that processes errors and shows appropriate messages
 */
export const useMutationErrorHandler = (showSnackbar: (message: string, severity?: 'success' | 'error') => void) => {
  const handleError = useCallback(
    (error: unknown, defaultMessage: string) => {
      const errorType = classifyApiError(error);
      const message = getApiErrorMessage(errorType, error);

      if (errorType === 'FORBIDDEN') {
        // 403: 권한 없음 - 화면 유지, 메시지 표시
        showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
      } else {
        // Other errors: show specific or default message
        showSnackbar(message || defaultMessage, 'error');
      }
    },
    [showSnackbar]
  );

  return { handleError };
};
