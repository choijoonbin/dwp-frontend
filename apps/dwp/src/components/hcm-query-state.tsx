import { useTranslation } from 'react-i18next';
import { GuidedEmptyState, LocalErrorState, LoadingState } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { resolveHcmQueryFailure } from './hcm-query-state-model';

type HcmQueryStateSize = 'compact' | 'standard' | 'page';

export function HcmQueryState({
  loading = false,
  error,
  retrying = false,
  onRetry,
  size = 'standard',
}: {
  loading?: boolean;
  error?: unknown;
  retrying?: boolean;
  onRetry?: () => void;
  size?: HcmQueryStateSize;
}) {
  const { t } = useTranslation('hcm');
  if (loading) {
    return (
      <Stack data-testid="hcm-query-state" data-query-state="loading" aria-busy="true">
        <LoadingState
          size={size}
          variant="skeleton"
          skeletonRows={size === 'compact' ? 2 : 4}
          label={t('domains.loading')}
        />
      </Stack>
    );
  }

  const failure = resolveHcmQueryFailure(error);
  if (!failure) return null;

  if (failure.kind === 'permission') {
    return (
      <Stack data-testid="hcm-query-state" data-query-state="permission">
        <GuidedEmptyState
          kind="permission"
          size={size}
          title={t('domains.queryState.permissionTitle')}
          description={t('domains.queryState.permissionDescription')}
          actionLabel={onRetry ? t('domains.queryState.checkAccess') : undefined}
          onAction={onRetry}
        />
        {failure.reference && (
          <Typography
            variant="caption"
            color="text.secondary"
            textAlign="center"
            sx={{ mt: -3, mb: 3, px: 2, fontFamily: 'monospace', overflowWrap: 'anywhere' }}
          >
            {t('domains.queryState.reference', { reference: failure.reference })}
          </Typography>
        )}
      </Stack>
    );
  }

  if (failure.kind === 'not-found') {
    return (
      <Stack data-testid="hcm-query-state" data-query-state="not-found">
        <GuidedEmptyState
          kind="empty"
          size={size}
          title={t('domains.queryState.notFoundTitle')}
          description={t('domains.queryState.notFoundDescription')}
          actionLabel={onRetry ? t('common.retry') : undefined}
          onAction={onRetry}
        />
      </Stack>
    );
  }

  const titleKey =
    failure.kind === 'context-changed'
      ? 'domains.queryState.contextChangedTitle'
      : failure.kind === 'unavailable'
        ? 'domains.queryState.unavailableTitle'
        : 'common.loadError';
  const descriptionKey =
    failure.kind === 'context-changed'
      ? 'domains.queryState.contextChangedDescription'
      : failure.kind === 'unavailable'
        ? 'domains.queryState.unavailableDescription'
        : 'domains.loadError';
  return (
    <Stack data-testid="hcm-query-state" data-query-state={failure.kind}>
      <LocalErrorState
        size={size}
        title={t(titleKey)}
        description={t(descriptionKey)}
        requestIdLabel={
          failure.reference
            ? t('domains.queryState.reference', { reference: failure.reference })
            : undefined
        }
        retrying={retrying}
        retryLabel={onRetry ? t('common.retry') : undefined}
        onRetry={onRetry}
      />
    </Stack>
  );
}
