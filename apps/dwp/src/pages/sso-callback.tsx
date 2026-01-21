import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, HttpError } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

/**
 * SSO Callback Page
 * Handles SSO provider redirect and exchanges code/token for JWT
 */
export default function SSOCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract code or token from URL params
        const code = searchParams.get('code');
        const token = searchParams.get('token');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for SSO provider errors
        if (errorParam) {
          const errorMsg = errorDescription || errorParam || 'SSO 인증 실패';
          setError(errorMsg);
          // Redirect to sign-in after 3 seconds
          setTimeout(() => {
            navigate('/sign-in', { replace: true });
          }, 3000);
          return;
        }

        // If code is provided, exchange it for token
        if (code) {
          // TODO: Call SSO callback API to exchange code for JWT
          // For now, show error
          setError('SSO callback API는 아직 구현되지 않았습니다.');
          setTimeout(() => {
            navigate('/sign-in', { replace: true });
          }, 3000);
          return;
        }

        // If token is provided directly, use it
        if (token) {
          // TODO: Validate and store token
          // For now, show error
          setError('SSO token 처리 API는 아직 구현되지 않았습니다.');
          setTimeout(() => {
            navigate('/sign-in', { replace: true });
          }, 3000);
          return;
        }

        // No code or token provided
        setError('SSO 인증 정보가 없습니다.');
        setTimeout(() => {
          navigate('/sign-in', { replace: true });
        }, 3000);
      } catch (err) {
        const errorMsg =
          err instanceof HttpError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'SSO 인증 처리 중 오류가 발생했습니다.';
        setError(errorMsg);
        setTimeout(() => {
          navigate('/sign-in', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, auth]);

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 400, width: '100%' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            SSO 인증 실패
          </Typography>
          <Typography variant="body2">{error}</Typography>
          <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
            잠시 후 로그인 페이지로 이동합니다...
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress />
      <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
        SSO 인증 처리 중...
      </Typography>
    </Box>
  );
}
