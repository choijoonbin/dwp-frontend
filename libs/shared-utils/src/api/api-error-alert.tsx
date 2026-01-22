// ----------------------------------------------------------------------

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { classifyApiError, getApiErrorDisplayProps } from './api-error-handler';

import type { ApiErrorDisplayProps } from './api-error-handler';

// ----------------------------------------------------------------------

/**
 * ApiErrorAlert: 표준화된 API 에러 표시 컴포넌트
 * 
 * 401: "세션이 만료되었습니다" (전역 핸들러가 자동 처리하므로 일반적으로 표시되지 않음)
 * 403: "접근 권한이 없습니다" (warning 스타일)
 * 409: "중복된 사용자 또는 계정입니다" (error 스타일)
 * 500+: "일시적인 서버 오류" + 재시도 버튼
 * 기타: 일반 에러 메시지
 */
export const ApiErrorAlert = ({ error, onRetry, severity }: ApiErrorDisplayProps) => {
  const { severity: alertSeverity, message, showRetry } = getApiErrorDisplayProps(error);
  const errorType = classifyApiError(error);

  // 401은 전역 핸들러가 처리하므로 여기서는 표시하지 않음
  if (errorType === 'UNAUTHORIZED') {
    return null;
  }

  return (
    <Alert
      severity={severity ?? alertSeverity}
      action={
        showRetry && onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            재시도
          </Button>
        ) : undefined
      }
      sx={{ mb: 2 }}
    >
      {message}
    </Alert>
  );
};
