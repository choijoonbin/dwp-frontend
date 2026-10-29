import { useTranslation } from 'react-i18next';
import { Check, CircleAlert, LoaderCircle } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { NotificationSupportReference } from './notification-error-support';

import type { NotificationProfileSaveState } from './use-notification-profile-save-controller';

export function NotificationPreferenceSaveIndicator({
  state,
  savedAt,
  error,
  onRetry,
  retryDisabled,
}: {
  state: NotificationProfileSaveState;
  savedAt?: string | null;
  error?: unknown;
  onRetry?: () => void;
  retryDisabled: boolean;
}) {
  const { t } = useTranslation('notifications');
  const Icon = state === 'saving' ? LoaderCircle : state === 'error' ? CircleAlert : Check;
  const label =
    state === 'saving'
      ? t('preferences.save.saving')
      : state === 'error'
        ? t('preferences.save.error')
        : state === 'recovered'
          ? t('preferences.save.recovered')
          : state === 'saved'
            ? t('preferences.save.saved', {
                time: savedAt
                  ? formatDate(savedAt, { timeStyle: 'short' })
                  : t('preferences.save.now'),
              })
            : t('preferences.save.auto');
  return (
    <Stack
      direction="row"
      gap={0.75}
      alignItems="center"
      flexWrap="wrap"
      color={
        state === 'error'
          ? 'error.main'
          : state === 'saved' || state === 'recovered'
            ? 'success.main'
            : 'text.secondary'
      }
      minHeight={32}
    >
      <Stack
        component="span"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        direction="row"
        gap={0.75}
        alignItems="center"
      >
        <Icon size={16} className={state === 'saving' ? 'dwp-spin' : undefined} />
        <Typography variant="caption" color="inherit" fontWeight="fontWeightBold">
          {label}
        </Typography>
      </Stack>
      {state === 'error' && onRetry && (
        <ActionButton intent="quiet" size="small" onClick={onRetry} disabled={retryDisabled}>
          {t('actions.retry')}
        </ActionButton>
      )}
      {state === 'error' && error ? <NotificationSupportReference error={error} /> : null}
    </Stack>
  );
}
