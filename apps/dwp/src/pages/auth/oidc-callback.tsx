import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAuth,
  safeReturnUrl,
  getOidcCallback,
  extractAccessTokenFromLoginResponse,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

export default function OidcCallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      if (!code || !state) {
        setError(searchParams.get('error_description') || 'OIDC callback is invalid.');
        return;
      }

      try {
        const response = await getOidcCallback({
          code,
          state,
          providerKey: searchParams.get('providerKey') || undefined,
          tenantId: searchParams.get('tenantId') || undefined,
        });
        const token = extractAccessTokenFromLoginResponse(response.data);
        if (!token) throw new Error('Access token is missing.');
        await auth.loginWithToken(token);
        navigate(safeReturnUrl(searchParams.get('returnUrl')) || '/', { replace: true });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'OIDC login failed.');
      }
    };

    void run();
  }, [auth, navigate, searchParams]);

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      {error ? <Alert severity="error">{error}</Alert> : <CircularProgress />}
    </Box>
  );
}
