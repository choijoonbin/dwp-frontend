// ----------------------------------------------------------------------

import { memo } from 'react';
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
  ({ open, onClose, title, content, onConfirm, loading = false }: DeleteConfirmDialogProps) => (
    <ConfirmDialog
      open={open}
      title={title}
      description={content}
      confirmText="삭제"
      cancelText="취소"
      severity="danger"
      loading={loading}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
);

DeleteConfirmDialog.displayName = 'DeleteConfirmDialog';
