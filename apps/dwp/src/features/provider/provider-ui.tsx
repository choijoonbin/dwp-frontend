import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function providerError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
export function formatProviderDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : formatDate(parsed, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

export function parseProviderJson(value?: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function ProviderStatusChip({ state }: { state: string }) {
  const { t } = useTranslation('provider');
  const color = [
    'ACTIVE',
    'READY',
    'SUCCEEDED',
    'VERIFIED',
    'HEALTHY',
    'APPROVED',
    'COMPLIANT',
    'COMPLETED',
    'RESOLVED',
    'CLOSED',
  ].includes(state)
    ? 'success'
    : [
          'FAILED',
          'DEGRADED',
          'REVOKED',
          'CRITICAL',
          'REJECTED',
          'NON_COMPLIANT',
          'EXHAUSTED',
          'ERROR',
        ].includes(state)
      ? 'error'
      : [
            'PREVIEWED',
            'DRAFT',
            'PARTIAL',
            'PENDING_EXTERNAL',
            'PENDING',
            'PROVISIONING',
            'ATTENTION',
            'INVESTIGATING',
            'IDENTIFIED',
            'MONITORING',
            'TRIAL',
            'AT_RISK',
            'NO_DATA',
            'IN_PROGRESS',
          ].includes(state)
        ? 'warning'
        : 'default';

  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={t(`states.${state}`, { defaultValue: state })}
    />
  );
}

export function ProviderLoading() {
  const { t } = useTranslation('provider');
  return (
    <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}>
      <Stack alignItems="center" gap={1.25}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">
          {t('loading')}
        </Typography>
      </Stack>
    </Box>
  );
}

export function ProviderError({ error }: { error: unknown }) {
  const { t } = useTranslation('provider');
  return <Alert severity="error">{providerError(error, t('errors.load'))}</Alert>;
}

export function ProviderSectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      justifyContent="space-between"
      gap={1.5}
    >
      <Box>
        <Typography component="h2" variant="h6">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}
