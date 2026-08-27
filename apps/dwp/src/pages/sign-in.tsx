import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAuth,
  safeReturnUrl,
  buildOidcLoginUrl,
  useLoginOptionsQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, type Theme } from '@mui/material/styles';

const fieldSx = (theme: Theme) => ({
  '& .MuiOutlinedInput-root': {
    minHeight: 50,
    overflow: 'hidden',
    backgroundColor: theme.palette.background.paper,
    transition: 'border-color 120ms ease-out, box-shadow 120ms ease-out',
    '& fieldset': { borderColor: theme.palette.divider },
    '&:hover fieldset': { borderColor: theme.palette.text.secondary },
    '&.Mui-focused': {
      boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.12)}`,
    },
  },
  '& .MuiOutlinedInput-input': { py: 1.5 },
  '& .MuiOutlinedInput-input:-webkit-autofill, & .MuiOutlinedInput-input:-webkit-autofill:hover, & .MuiOutlinedInput-input:-webkit-autofill:focus, & .MuiOutlinedInput-input:-webkit-autofill:active':
    {
      WebkitBoxShadow: `0 0 0 100px ${theme.palette.background.paper} inset !important`,
      WebkitTextFillColor: `${theme.palette.text.primary} !important`,
      caretColor: theme.palette.text.primary,
      transition: 'background-color 9999s ease-out 0s',
    },
});

const primaryActionSx = {
  minHeight: 50,
  '& .MuiButton-endIcon': {
    transition: 'transform 160ms cubic-bezier(0.2, 0, 0, 1)',
  },
  '&:hover .MuiButton-endIcon': {
    transform: 'translateX(3px)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& .MuiButton-endIcon': { transition: 'none' },
    '&:hover .MuiButton-endIcon': { transform: 'none' },
  },
} as const;

const labelSx = {
  mb: 0.75,
  color: 'text.primary',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  fontWeight: 700,
  '&.Mui-focused': { color: 'text.primary' },
  '& .MuiFormLabel-asterisk': { color: 'error.main' },
} as const;

export default function SignInPage() {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginOptionsQuery = useLoginOptionsQuery();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<'loginFailed' | null>(null);

  const allowLocal = useMemo(
    () => Boolean(loginOptionsQuery.data?.localLoginAvailable),
    [loginOptionsQuery.data]
  );
  const allowSso = Boolean(loginOptionsQuery.data?.ssoLoginAvailable);
  const preferSso = Boolean(
    allowSso && (!allowLocal || loginOptionsQuery.data?.preferredLoginType === 'SSO')
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorKey(null);
    setSubmitting(true);
    try {
      await auth.login({ email, password });
      navigate(safeReturnUrl(searchParams.get('returnUrl')) || '/', { replace: true });
    } catch {
      setErrorKey('loginFailed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loginOptionsQuery.isLoading) {
    return (
      <Box
        role="status"
        aria-label={t('signIn.loadingOptions')}
        sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (loginOptionsQuery.error || !loginOptionsQuery.data) {
    return <Alert severity="error">{t('errors.policyLoadFailed')}</Alert>;
  }

  const localForm = allowLocal ? (
    <Box component="form" onSubmit={submit} sx={{ display: 'grid', gap: 2.5 }}>
      <FormControl required fullWidth>
        <FormLabel htmlFor="dwp-email" sx={labelSx}>
          {t('signIn.email')}
        </FormLabel>
        <TextField
          id="dwp-email"
          name="email"
          required
          fullWidth
          hiddenLabel
          type="email"
          inputMode="email"
          autoFocus={!preferSso}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('signIn.emailPlaceholder')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          sx={fieldSx}
        />
      </FormControl>

      <FormControl required fullWidth>
        <FormLabel htmlFor="dwp-password" sx={labelSx}>
          {t('signIn.password')}
        </FormLabel>
        <TextField
          id="dwp-password"
          name="password"
          required
          fullWidth
          hiddenLabel
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder={t('signIn.passwordPlaceholder')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          sx={fieldSx}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip
                    title={showPassword ? t('signIn.hidePassword') : t('signIn.showPassword')}
                  >
                    <IconButton
                      edge="end"
                      aria-label={
                        showPassword ? t('signIn.hidePassword') : t('signIn.showPassword')
                      }
                      onClick={() => setShowPassword((visible) => !visible)}
                      onMouseDown={(event) => event.preventDefault()}
                      sx={{ width: 36, height: 36 }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            },
          }}
        />
      </FormControl>

      <Button
        type="submit"
        size="large"
        variant={preferSso ? 'outlined' : 'contained'}
        disabled={submitting}
        endIcon={!submitting ? <ArrowRight size={18} /> : undefined}
        sx={{ ...primaryActionSx, mt: 0.5 }}
      >
        {submitting ? (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={17} color="inherit" />
            {t('signIn.submitting')}
          </Box>
        ) : (
          t('signIn.submit')
        )}
      </Button>
    </Box>
  ) : null;

  const ssoButton = allowSso ? (
    <Button
      fullWidth
      size="large"
      variant={preferSso ? 'contained' : 'outlined'}
      startIcon={<ShieldCheck size={18} />}
      onClick={() => window.location.assign(buildOidcLoginUrl())}
      sx={{ minHeight: 50 }}
    >
      {t('signIn.sso')}
    </Button>
  ) : null;

  return (
    <Box>
      <Box sx={{ mb: 4.5 }}>
        <Typography
          variant="overline"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'primary.main',
            '&::before': {
              content: '""',
              width: 24,
              height: 2,
              bgcolor: 'secondary.main',
            },
          }}
        >
          {t('signIn.eyebrow')}
        </Typography>
        <Typography component="h2" variant="h2" sx={{ mt: 1.25 }}>
          {t('signIn.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('signIn.description')}
        </Typography>
      </Box>

      {errorKey && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {t(`errors.${errorKey}`)}
        </Alert>
      )}

      {preferSso && ssoButton}
      {preferSso && allowLocal && <Divider sx={{ my: 3 }}>{t('signIn.separator')}</Divider>}
      {localForm}
      {!preferSso && allowLocal && allowSso && (
        <Divider sx={{ my: 3 }}>{t('signIn.separator')}</Divider>
      )}
      {!preferSso && ssoButton}

      {!allowLocal && !allowSso && <Alert severity="warning">{t('errors.noMethods')}</Alert>}

      <Box
        sx={{
          mt: 4,
          pt: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: 'text.secondary',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ShieldCheck size={16} aria-hidden="true" />
        <Typography variant="caption">{t('signIn.policyNotice')}</Typography>
      </Box>
    </Box>
  );
}
