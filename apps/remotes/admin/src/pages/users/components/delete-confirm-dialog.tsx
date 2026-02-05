// ----------------------------------------------------------------------

import { memo } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { ConfirmDialog } from '@dwp-frontend/design-system';

// ----------------------------------------------------------------------

type DeleteConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onConfirm: () => void;
  loading?: boolean;
};

export const DeleteConfirmDialog = memo(
  ({ open, onClose, title, content, onConfirm, loading = false }: DeleteConfirmDialogProps) => {
    const { t } = useTranslation('common');
    return (
    <ConfirmDialog
      open={open}
      title={title}
      description={content}
      confirmText={t('confirm.delete')}
      cancelText={t('confirm.cancel')}
      severity="danger"
      loading={loading}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
  }
);

DeleteConfirmDialog.displayName = 'DeleteConfirmDialog';
