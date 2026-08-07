import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, safeReturnUrl, getOidcCallback } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

export default function OidcCallbackPage() {
  const { refreshSession } = useAuth();
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
        await getOidcCallback({
          code,
          state,
          providerKey: searchParams.get('providerKey') || undefined,
          tenantId: searchParams.get('tenantId') || undefined,
        });
        const authenticated = await refreshSession();
        if (!authenticated) throw new Error('The authenticated session could not be verified.');
        navigate(safeReturnUrl(searchParams.get('returnUrl')) || '/', { replace: true });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'OIDC login failed.');
      }
    };

    void run();
  }, [navigate, refreshSession, searchParams]);

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      {error ? <Alert severity="error">{error}</Alert> : <CircularProgress />}
    </Box>
  );
}
