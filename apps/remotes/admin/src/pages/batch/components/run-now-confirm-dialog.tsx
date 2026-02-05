// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

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
}: RunNowConfirmDialogProps) => (
  <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="xs" fullWidth>
    <DialogTitle>배치 수동 실행</DialogTitle>
    <DialogContent>
      <Stack spacing={1}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Detect 배치를 지금 실행합니다. 실행 중인 배치가 있으면 건너뜀(SKIPPED)될 수 있습니다.
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          실행 후 Run History에 결과가 표시됩니다.
        </Typography>
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={isSubmitting}>
        취소
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
        {isSubmitting ? '실행 중...' : '실행'}
      </Button>
    </DialogActions>
  </Dialog>
));
