import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAuth,
  useIdpQuery,
  safeReturnUrl,
  buildOidcLoginUrl,
  useAuthPolicyQuery,
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

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 50,
    bgcolor: 'background.paper',
    transition: 'border-color 120ms ease-out, box-shadow 120ms ease-out',
    '& fieldset': { borderColor: 'divider' },
    '&:hover fieldset': { borderColor: 'text.secondary' },
    '&.Mui-focused': {
      boxShadow: (theme: Theme) => `0 0 0 4px ${alpha(theme.palette.primary.main, 0.12)}`,
    },
  },
  '& .MuiOutlinedInput-input': { py: 1.5 },
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
  const policyQuery = useAuthPolicyQuery();
  const idpQuery = useIdpQuery();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<'loginFailed' | null>(null);

  const allowLocal = useMemo(
    () =>
      Boolean(
        policyQuery.data?.localLoginEnabled && policyQuery.data.allowedLoginTypes.includes('LOCAL')
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
    setErrorKey(null);
    setSubmitting(true);
    try {
      await auth.login({ username, password });
      navigate(safeReturnUrl(searchParams.get('returnUrl')) || '/', { replace: true });
    } catch {
      setErrorKey('loginFailed');
    } finally {
      setSubmitting(false);
    }
  };

  if (policyQuery.isLoading || idpQuery.isLoading) {
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

  if (policyQuery.error || !policyQuery.data) {
    return <Alert severity="error">{t('errors.policyLoadFailed')}</Alert>;
  }

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

      {allowLocal && (
        <Box component="form" onSubmit={submit} sx={{ display: 'grid', gap: 2.5 }}>
          <FormControl required fullWidth>
            <FormLabel htmlFor="dwp-username" sx={labelSx}>
              {t('signIn.username')}
            </FormLabel>
            <TextField
              id="dwp-username"
              name="username"
              required
              fullWidth
              hiddenLabel
              autoFocus
              autoComplete="username"
              placeholder={t('signIn.usernamePlaceholder')}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
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
            variant="contained"
            disabled={submitting}
            endIcon={!submitting ? <ArrowRight size={18} /> : undefined}
            sx={{ minHeight: 50, mt: 0.5 }}
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
      )}

      {allowLocal && allowSso && <Divider sx={{ my: 3 }}>{t('signIn.separator')}</Divider>}

      {allowSso && idpQuery.data && (
        <Button
          fullWidth
          size="large"
          variant={allowLocal ? 'outlined' : 'contained'}
          startIcon={<ShieldCheck size={18} />}
          onClick={() => window.location.assign(buildOidcLoginUrl(idpQuery.data!.providerKey))}
          sx={{ minHeight: 50 }}
        >
          {t('signIn.sso')}
        </Button>
      )}

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
