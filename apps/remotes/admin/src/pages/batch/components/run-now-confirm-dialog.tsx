// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

type RunNowConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
};

export const RunNowConfirmDialog = memo(({
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: RunNowConfirmDialogProps) => {
  const { t } = useTranslation('admin');
  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('batch.runNowDialog.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('batch.runNowDialog.body')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('batch.runNowDialog.hint')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t('batch.runNowDialog.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={isSubmitting}
          startIcon={
            isSubmitting ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <Iconify icon="solar:play-bold" width={18} />
            )
          }
        >
          {isSubmitting ? t('batch.runNowDialog.running') : t('batch.runNowDialog.execute')}
        </Button>
      </DialogActions>
    </Dialog>
  );
});
