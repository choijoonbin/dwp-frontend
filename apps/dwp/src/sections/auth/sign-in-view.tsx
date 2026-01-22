import { useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAuth,
  HttpError,
  useIdpQuery,
  safeReturnUrl,
  useAuthPolicyQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const SignInView = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();

  // Auth policy query
  const { data: authPolicy, isLoading: policyLoading, error: policyError } = useAuthPolicyQuery();
  const { data: idpConfig, isLoading: idpLoading, error: idpError } = useIdpQuery();

  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin1234!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorSeverity, setErrorSeverity] = useState<'error' | 'warning'>('error');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine UI visibility based on policy
  const showLocalLogin = useMemo(() => {
    if (!authPolicy) return false;
    return authPolicy.allowedLoginTypes.includes('LOCAL');
  }, [authPolicy]);

  const showSsoLogin = useMemo(() => {
    if (!authPolicy) return false;
    return authPolicy.allowedLoginTypes.includes('SSO');
  }, [authPolicy]);

  const isDefaultLocal = useMemo(() => {
    if (!authPolicy) return true; // Default to LOCAL if policy not loaded
    return authPolicy.defaultLoginType === 'LOCAL';
  }, [authPolicy]);

  const isDefaultSso = useMemo(() => {
    if (!authPolicy) return false;
    return authPolicy.defaultLoginType === 'SSO';
  }, [authPolicy]);

  const handleSignIn = useCallback(async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    // Check if LOCAL login is allowed
    if (!showLocalLogin) {
      setErrorSeverity('error');
      setErrorMessage('LOCAL 로그인이 허용되지 않습니다. SSO 로그인을 사용해주세요.');
      setIsSubmitting(false);
      return;
    }

    try {
      await auth.login({ username, password });

      // Handle returnUrl: redirect to safe returnUrl or default to /
      const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));
      navigate(returnUrl || '/', { replace: true });
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        setErrorSeverity('warning');
        setErrorMessage('로그인 API는 아직 백엔드(dwp-auth-server)에 구현되어 있지 않습니다.');
      } else if (err instanceof HttpError && err.status === 403) {
        setErrorSeverity('error');
        setErrorMessage('LOCAL 로그인 권한이 없습니다. SSO 로그인을 사용해주세요.');
      } else {
        setErrorSeverity('error');
        const msg = err instanceof Error ? err.message : 'Login failed';
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [auth, username, password, navigate, searchParams, showLocalLogin]);

  const handleSsoLogin = useCallback(() => {
    if (!showSsoLogin) {
      setErrorSeverity('error');
      setErrorMessage('SSO 로그인이 허용되지 않습니다.');
      return;
    }

    if (idpConfig?.authUrl) {
      // Build callback URL
      const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));
      const callbackUrl = `${window.location.origin}/sso-callback${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`;
      
      // Append callback URL to authUrl if needed
      const separator = idpConfig.authUrl.includes('?') ? '&' : '?';
      const redirectUrl = `${idpConfig.authUrl}${separator}redirect_uri=${encodeURIComponent(callbackUrl)}`;
      
      // Redirect to SSO provider
      window.location.href = redirectUrl;
    } else {
      // No authUrl configured
      setErrorSeverity('error');
      setErrorMessage('SSO 설정이 완료되지 않았습니다. 관리자에게 문의하세요.');
    }
  }, [idpConfig, showSsoLogin, searchParams]);

  // Policy loading state
  if (policyLoading || (showSsoLogin && idpLoading)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          로그인 정책을 불러오는 중...
        </Typography>
      </Box>
    );
  }

  // Policy error state - NO FALLBACK
  if (policyError || !authPolicy) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
        }}
      >
        <Alert severity="error" sx={{ width: '100%', maxWidth: 400 }}>
          테넌트 정책 조회 실패
          <Typography variant="body2" sx={{ mt: 1 }}>
            {policyError instanceof Error ? policyError.message : '로그인 정책을 불러올 수 없습니다.'}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // IDP error state (only if SSO is required)
  if (showSsoLogin && idpError && !idpConfig) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
        }}
      >
        <Alert severity="warning" sx={{ width: '100%', maxWidth: 400 }}>
          SSO 설정 조회 실패
          <Typography variant="body2" sx={{ mt: 1 }}>
            {idpError instanceof Error ? idpError.message : 'SSO 설정을 불러올 수 없습니다.'}
          </Typography>
          {showLocalLogin && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              LOCAL 로그인을 사용할 수 있습니다.
            </Typography>
          )}
        </Alert>
      </Box>
    );
  }

  // No login methods available
  if (!showLocalLogin && !showSsoLogin) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
        }}
      >
        <Alert severity="warning" sx={{ width: '100%', maxWidth: 400 }}>
          사용 가능한 로그인 방법이 없습니다.
          <Typography variant="body2" sx={{ mt: 1 }}>
            관리자에게 문의하세요.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const renderLocalForm = showLocalLogin ? (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        flexDirection: 'column',
      }}
    >
      {!!errorMessage && (
        <Alert severity={errorSeverity} variant="outlined" sx={{ width: 1, mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <TextField
        fullWidth
        name="username"
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        data-testid="auth-username"
        sx={{ mb: 3 }}
        slotProps={{
          inputLabel: { shrink: true },
        }}
      />

      {showLocalLogin && (
        <Link
          component={RouterLink}
          href="/forgot-password"
          variant="body2"
          color="inherit"
          sx={{ mb: 1.5 }}
        >
          Forgot password?
        </Link>
      )}

      <TextField
        fullWidth
        name="password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type={showPassword ? 'text' : 'password'}
        data-testid="auth-password"
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                  <Iconify icon={showPassword ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 3 }}
      />

      <Button
        fullWidth
        size="large"
        type="submit"
        color={isDefaultLocal ? 'primary' : 'inherit'}
        variant="contained"
        onClick={handleSignIn}
        disabled={isSubmitting}
        data-testid="auth-submit"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </Box>
  ) : null;

  const renderSsoButton = showSsoLogin ? (
    <Button
      fullWidth
      size="large"
      color={isDefaultSso ? 'primary' : 'inherit'}
      variant={isDefaultSso ? 'contained' : 'outlined'}
      onClick={handleSsoLogin}
      startIcon={<Iconify icon="solar:shield-user-bold" />}
    >
      {idpConfig?.providerName ? `${idpConfig.providerName}로 로그인` : 'SSO로 로그인'}
    </Button>
  ) : null;

  const showDivider = showLocalLogin && showSsoLogin;

  return (
    <Box>
      <Box
        sx={{
          gap: 1.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mb: 5,
        }}
      >
        <Typography variant="h5">Sign in</Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          Don&apos;t have an account?
          <Link variant="subtitle2" sx={{ ml: 0.5 }}>
            Get started
          </Link>
        </Typography>
      </Box>

      {isDefaultSso && showSsoLogin ? (
        <Box>
          {renderSsoButton}
          {showDivider && (
            <Divider sx={{ my: 3, '&::before, &::after': { borderTopStyle: 'dashed' } }}>
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', fontWeight: 'fontWeightMedium' }}
              >
                OR
              </Typography>
            </Divider>
          )}
          {renderLocalForm}
        </Box>
      ) : (
        <Box>
          {renderLocalForm}
          {showDivider && (
            <Divider sx={{ my: 3, '&::before, &::after': { borderTopStyle: 'dashed' } }}>
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', fontWeight: 'fontWeightMedium' }}
              >
                OR
              </Typography>
            </Divider>
          )}
          {renderSsoButton}
        </Box>
      )}

    </Box>
  );
};
