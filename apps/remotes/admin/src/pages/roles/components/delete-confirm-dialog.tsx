// ----------------------------------------------------------------------

import { useTranslation } from '@dwp-frontend/shared-i18n';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import type { DeleteConfirmDialogProps } from '../types';

// ----------------------------------------------------------------------

export const DeleteConfirmDialog = ({ open, onClose, title, content, onConfirm }: DeleteConfirmDialogProps) => {
  const { t } = useTranslation('common');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{content}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('confirm.cancel')}</Button>
        <Button variant="contained" color="error" onClick={onConfirm}>
          {t('confirm.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
