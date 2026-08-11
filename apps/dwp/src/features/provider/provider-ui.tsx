import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { ErrorState, LoadingState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function providerError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const status = 'status' in error && typeof error.status === 'number' ? error.status : undefined;
  if (
    status === undefined &&
    error.name !== 'AbortError' &&
    error.message !== 'Internal Server Error'
  ) {
    return error.message;
  }
  if (status !== undefined && status > 0 && status < 500 && error.message) return error.message;
  return fallback;
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
  return <LoadingState label={t('loading')} variant="skeleton" size="standard" />;
}

export function ProviderError({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation('provider');
  return (
    <ErrorState
      title={t('errors.loadTitle')}
      description={providerError(error, t('errors.load'))}
      retryLabel={t('actions.retryLoad')}
      onRetry={onRetry}
      retrying={retrying}
      size="standard"
    />
  );
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
