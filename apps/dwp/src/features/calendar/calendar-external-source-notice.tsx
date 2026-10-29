import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';

import type { CalendarExternalProjection } from '@dwp-frontend/shared-utils';

export function CalendarExternalSourceNotice({
  projection,
  error,
  retrying,
  onRetry,
}: Readonly<{
  projection?: CalendarExternalProjection;
  error: boolean;
  retrying: boolean;
  onRetry: () => void;
}>) {
  const { t } = useTranslation('calendar');
  const unhealthy = projection?.sources.find((source) => source.status !== 'HEALTHY');
  if (!error && !unhealthy) return null;

  const status = error ? 'UNAVAILABLE' : (unhealthy?.status ?? 'UNAVAILABLE');
  return (
    <Alert
      severity={status === 'UNAVAILABLE' ? 'info' : 'warning'}
      sx={{ mb: 1.5 }}
      action={
        <ActionButton intent="quiet" size="small" disabled={retrying} onClick={onRetry}>
          {t('actions.retry')}
        </ActionButton>
      }
    >
      {t(`external.status.${status}`)}
    </Alert>
  );
}
