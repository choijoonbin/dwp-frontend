import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@dwp-frontend/design-system';
import { activateAccount, getAccountActivation, setTenantId } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

const isStrongPassword = (value: string) =>
  value.length >= 12 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

export default function AccountActivationPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [activated, setActivated] = useState(false);
  const activation = useQuery({
    queryKey: ['auth', 'activation', token],
    queryFn: () => getAccountActivation(token),
    enabled: Boolean(token),
    retry: false,
  });
  const passwordValid = isStrongPassword(password);
  const confirmationValid = password === confirmation;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !passwordValid || !confirmationValid) return;
    setSubmitting(true);
    setError(false);
    try {
      const result = await activateAccount(token, password);
      setTenantId(result.tenantId);
      setActivated(true);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return <Alert severity="error">{t('activation.invalid')}</Alert>;
  if (activation.isLoading) return <LoadingState label={t('common:labels.loading')} size="page" />;
  if (activation.isError || !activation.data)
    return <Alert severity="error">{t('activation.invalid')}</Alert>;

  if (activated) {
    return (
      <Stack alignItems="flex-start" gap={2.5}>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            color: 'success.main',
            bgcolor: 'success.main',
            borderRadius: 1,
            '& svg': { color: 'success.contrastText' },
          }}
        >
          <CheckCircle2 size={23} />
        </Box>
        <Box>
          <Typography component="h2" variant="h4">
            {t('activation.completeTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('activation.completeDescription', { tenant: activation.data.tenantName })}
          </Typography>
        </Box>
        <Button
          fullWidth
          size="large"
          variant="contained"
          endIcon={<ArrowRight size={18} />}
          onClick={() =>
            navigate(`/sign-in?email=${encodeURIComponent(activation.data.email)}`, {
              replace: true,
            })
          }
        >
          {t('activation.signIn')}
        </Button>
      </Stack>
    );
  }

  return (
    <Box component="form" onSubmit={submit}>
      <Stack gap={2.5}>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'action.selected',
            borderRadius: 1,
          }}
        >
          <KeyRound size={22} />
        </Box>
        <Box>
          <Typography component="h2" variant="h4">
            {t('activation.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('activation.identity', {
              name: activation.data.displayName,
              tenant: activation.data.tenantName,
            })}
          </Typography>
        </Box>
        {error && <Alert severity="error">{t('activation.failed')}</Alert>}
        <TextField
          required
          fullWidth
          label={t('activation.password')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={Boolean(password) && !passwordValid}
          helperText={t('activation.passwordHelp')}
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
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          required
          fullWidth
          label={t('activation.confirmPassword')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          error={Boolean(confirmation) && !confirmationValid}
          helperText={confirmation && !confirmationValid ? t('activation.passwordMismatch') : ' '}
        />
        <Button
          type="submit"
          fullWidth
          size="large"
          variant="contained"
          disabled={submitting || !passwordValid || !confirmationValid}
          endIcon={!submitting ? <ArrowRight size={18} /> : undefined}
          sx={{ minHeight: 50 }}
        >
          {submitting ? (
            <Stack component="span" direction="row" alignItems="center" gap={1}>
              <CircularProgress size={18} color="inherit" aria-hidden="true" />
              {t('activation.submit')}
            </Stack>
          ) : (
            t('activation.submit')
          )}
        </Button>
      </Stack>
    </Box>
  );
}
