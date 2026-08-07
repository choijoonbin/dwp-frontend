import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAuth,
  HttpError,
  useIdpQuery,
  safeReturnUrl,
  buildOidcLoginUrl,
  useAuthPolicyQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

export default function SignInPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const policyQuery = useAuthPolicyQuery();
  const idpQuery = useIdpQuery();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowLocal = useMemo(
    () =>
      Boolean(
        policyQuery.data?.localLoginEnabled &&
          policyQuery.data.allowedLoginTypes.includes('LOCAL')
      ),
    [policyQuery.data]
  );
  const allowSso = Boolean(
    policyQuery.data?.ssoLoginEnabled &&
      policyQuery.data.allowedLoginTypes.includes('SSO') &&
      idpQuery.data?.providerKey
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await auth.login({ username, password });
      navigate(safeReturnUrl(searchParams.get('returnUrl')) || '/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof HttpError || caught instanceof Error ? caught.message : 'Login failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (policyQuery.isLoading || idpQuery.isLoading) {
    return (
      <Box sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (policyQuery.error || !policyQuery.data) {
    return <Alert severity="error">로그인 정책을 불러올 수 없습니다.</Alert>;
  }

  return (
    <Box>
      <Typography component="h1" variant="h5">
        Sign in
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
        DWP
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {allowLocal && (
        <Box component="form" onSubmit={submit} sx={{ display: 'grid', gap: 2.5 }}>
          <TextField
            required
            fullWidth
            autoComplete="username"
            label="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextField
            required
            fullWidth
            type="password"
            autoComplete="current-password"
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" size="large" variant="contained" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </Box>
      )}

      {allowLocal && allowSso && <Divider sx={{ my: 3 }}>OR</Divider>}

      {allowSso && idpQuery.data && (
        <Button
          fullWidth
          size="large"
          variant={allowLocal ? 'outlined' : 'contained'}
          onClick={() => window.location.assign(buildOidcLoginUrl(idpQuery.data!.providerKey))}
        >
          SSO로 로그인
        </Button>
      )}

      {!allowLocal && !allowSso && (
        <Alert severity="warning">사용 가능한 로그인 방법이 없습니다.</Alert>
      )}
    </Box>
  );
}
