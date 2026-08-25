import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';

export function NotificationBulkUndoBanner({
  expiresAt,
  busy,
  onUndo,
  onDismiss,
}: {
  expiresAt: string;
  busy: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Alert
      severity="success"
      variant="outlined"
      onClose={busy ? undefined : onDismiss}
      action={
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<RotateCcw size={16} />}
          onClick={onUndo}
          disabled={busy}
        >
          {busy ? t('bulk.undoing') : t('bulk.undo')}
        </ActionButton>
      }
      sx={{ borderInline: 0, borderTop: 0, borderRadius: 0 }}
    >
      {t('bulk.undoAvailable', {
        time: formatDate(expiresAt, {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })}
    </Alert>
  );
}
