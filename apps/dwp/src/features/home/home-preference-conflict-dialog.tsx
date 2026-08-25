import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { ActionButton, FormDialog } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type HomePreferenceConflictDialogProps = {
  open: boolean;
  changeCount: number;
  latestVersion?: number;
  busy?: boolean;
  onReloadLatest: () => void;
  onReapply: () => void;
  onClose: () => void;
};

export function HomePreferenceConflictDialog({
  open,
  changeCount,
  latestVersion,
  busy = false,
  onReloadLatest,
  onReapply,
  onClose,
}: HomePreferenceConflictDialogProps) {
  const { t } = useTranslation('home');
  return (
    <FormDialog
      open={open}
      title={t('flow.conflict.title')}
      cancelLabel={t('flow.conflict.keepEditing')}
      submitLabel={t('flow.conflict.reapply')}
      submittingLabel={t('flow.conflict.reapply')}
      onClose={onClose}
      onSubmit={onReapply}
      busy={busy}
      maxWidth="sm"
      secondaryActions={
        <ActionButton
          intent="quiet"
          startIcon={<RefreshCw size={15} aria-hidden="true" />}
          onClick={onReloadLatest}
          disabled={busy}
        >
          {t('flow.conflict.reload')}
        </ActionButton>
      }
    >
      <Stack gap={2}>
        <Alert severity="warning">{t('flow.conflict.description')}</Alert>
        <Stack gap={1.25}>
          <Typography variant="body2">
            {t('flow.conflict.myChanges', { count: changeCount })}
          </Typography>
          <Typography variant="body2">
            {t('flow.conflict.latestVersion', { version: latestVersion ?? '-' })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('flow.conflict.safety')}
          </Typography>
        </Stack>
      </Stack>
    </FormDialog>
  );
}
