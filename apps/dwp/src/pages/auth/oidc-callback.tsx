import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAuth,
  HttpError,
  getOidcCallback,
  extractAccessTokenFromLoginResponse,
  safeReturnUrl,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

/**
 * OIDC Callback Page
 * BE contract: redirect_uri = {FE_ORIGIN}/auth/oidc/callback
 * Reads code/state/providerKey from URL, calls GET /api/auth/oidc/callback, stores JWT, redirects.
 */
export default function OidcCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        const msg = errorDescription || errorParam || 'OIDC 인증 실패';
        setError(msg);
        setTimeout(() => navigate('/sign-in', { replace: true }), 3000);
        return;
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const providerKey = searchParams.get('providerKey') ?? undefined;
      const tenantId = searchParams.get('tenantId') ?? undefined;
      const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));

      if (!code || !state) {
        setError('code 또는 state가 없습니다.');
        setTimeout(() => navigate('/sign-in', { replace: true }), 3000);
        return;
      }

      try {
        const res = await getOidcCallback({ code, state, providerKey, tenantId });
        const token = extractAccessTokenFromLoginResponse(res.data);
        if (!token) {
          setError('응답에 액세스 토큰이 없습니다.');
          setTimeout(() => navigate('/sign-in', { replace: true }), 3000);
          return;
        }
        await auth.loginWithToken(token);
        navigate(returnUrl || '/', { replace: true });
      } catch (err) {
        const msg =
          err instanceof HttpError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'OIDC 콜백 처리 중 오류가 발생했습니다.';
        setError(msg);
        setTimeout(() => navigate('/sign-in', { replace: true }), 3000);
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
            OIDC 인증 실패
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
        OIDC 인증 처리 중...
      </Typography>
    </Box>
  );
}
