import { useTranslation } from '@dwp-frontend/shared-i18n';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

// ----------------------------------------------------------------------

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText,
  severity = 'default',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  const resolvedConfirmText = confirmText ?? t('confirm.confirm');
  const resolvedCancelText = cancelText ?? t('confirm.cancel');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>

      {description && (
        <DialogContent>
          <DialogContentText>{description}</DialogContentText>
        </DialogContent>
      )}

      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Button onClick={onClose} variant="outlined" fullWidth>
            {resolvedCancelText}
          </Button>

          <LoadingButton
            onClick={onConfirm}
            variant="contained"
            color={severity === 'danger' ? 'error' : 'primary'}
            loading={loading}
            fullWidth
          >
            {resolvedConfirmText}
          </LoadingButton>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
