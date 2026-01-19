import { useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth, HttpError, safeReturnUrl } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';
import { RouterLink } from 'src/routes/components';

// ----------------------------------------------------------------------

export const SignInView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const auth = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('hello@gmail.com');
  const [password, setPassword] = useState('@demo1234');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorSeverity, setErrorSeverity] = useState<'error' | 'warning'>('error');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const renderForm = (
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

      <Link
        component={RouterLink}
        href="/forgot-password"
        variant="body2"
        color="inherit"
        sx={{ mb: 1.5 }}
      >
        Forgot password?
      </Link>

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
        color="inherit"
        variant="contained"
        onClick={handleSignIn}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </Box>
  );

  return (
    <>
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
          Don’t have an account?
          <Link variant="subtitle2" sx={{ ml: 0.5 }}>
            Get started
          </Link>
        </Typography>
      </Box>
      {renderForm}
      <Divider sx={{ my: 3, '&::before, &::after': { borderTopStyle: 'dashed' } }}>
        <Typography
          variant="overline"
          sx={{ color: 'text.secondary', fontWeight: 'fontWeightMedium' }}
        >
          OR
        </Typography>
      </Divider>
      <Box
        sx={{
          gap: 1,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <IconButton color="inherit">
          <Iconify width={22} icon="socials:google" />
        </IconButton>
        <IconButton color="inherit">
          <Iconify width={22} icon="socials:github" />
        </IconButton>
        <IconButton color="inherit">
          <Iconify width={22} icon="socials:twitter" />
        </IconButton>
      </Box>
    </>
  );
};
