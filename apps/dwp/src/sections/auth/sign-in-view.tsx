import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  useAuth,
  HttpError,
  safeReturnUrl,
  useAuthPolicyQuery,
  useIdpQuery,
  type LoginType,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const SignInView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const auth = useAuth();

  // Auth policy query
  const { data: authPolicy, isLoading: policyLoading, error: policyError } = useAuthPolicyQuery();
  const { data: idpConfig } = useIdpQuery();

  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin1234!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorSeverity, setErrorSeverity] = useState<'error' | 'warning'>('error');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ssoDialogOpen, setSsoDialogOpen] = useState(false);

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

    try {
      await auth.login({ username, password });

      // Handle returnUrl: redirect to safe returnUrl or default to /
      const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));
      navigate(returnUrl || '/', { replace: true });
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        setErrorSeverity('warning');
        setErrorMessage('로그인 API는 아직 백엔드(dwp-auth-server)에 구현되어 있지 않습니다.');
      } else {
        setErrorSeverity('error');
        const msg = err instanceof Error ? err.message : 'Login failed';
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [auth, username, password, navigate, searchParams]);

  const handleSsoLogin = useCallback(() => {
    if (idpConfig?.authUrl) {
      // If authUrl is provided, redirect to SSO provider
      window.location.href = idpConfig.authUrl;
    } else {
      // Otherwise, show placeholder dialog
      setSsoDialogOpen(true);
    }
  }, [idpConfig]);

  // Policy loading state
  if (policyLoading) {
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
      SSO로 로그인
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

      <Dialog open={ssoDialogOpen} onClose={() => setSsoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>SSO 로그인</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            SSO 연동은 준비중입니다.
          </Alert>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            SSO(Single Sign-On) 기능은 현재 개발 중입니다. 관리자에게 문의하세요.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSsoDialogOpen(false)}>확인</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
