import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailDraftSaveStatus } from './use-mail-draft-autosave';

export function MailDraftSaveStatus({
  status,
  onRetry,
}: {
  status: MailDraftSaveStatus;
  onRetry: () => void;
}) {
  const { t } = useTranslation('mail');

  if (status === 'EMPTY') {
    return (
      <Typography variant="caption" color="text.secondary" role="status">
        {t('draft.autosave.empty')}
      </Typography>
    );
  }
  if (status === 'DIRTY' || status === 'SAVING' || status === 'SAVED') {
    return (
      <Stack spacing={0.5} role="status" aria-live="polite">
        <Typography
          variant="caption"
          color={status === 'DIRTY' ? 'warning.main' : 'text.secondary'}
        >
          {t(`draft.autosave.${status.toLowerCase()}`)}
        </Typography>
        {status === 'SAVING' && <LinearProgress aria-label={t('draft.autosave.saving')} />}
      </Stack>
    );
  }

  return (
    <Alert
      severity={status === 'CONFLICT' ? 'warning' : 'error'}
      action={
        status === 'ERROR' ? (
          <ActionButton intent="quiet" onClick={onRetry}>
            {t('draft.autosave.retry')}
          </ActionButton>
        ) : undefined
      }
    >
      {t(`draft.autosave.${status.toLowerCase()}`)}
    </Alert>
  );
}
