import type { ReactNode } from 'react';

import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

export type EditorModalProps = {
  open: boolean;
  title: string;
  mode: 'create' | 'edit' | 'view';
  onClose: () => void;
  onSubmit?: () => void;
  loading?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  fullScreen?: boolean;
};

export function EditorModal({
  open,
  title,
  mode,
  onClose,
  onSubmit,
  loading = false,
  children,
  footer,
  fullScreen = false,
}: EditorModalProps) {
  const isViewMode = mode === 'view';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{title}</DialogTitle>

      <DialogContent dividers>{children}</DialogContent>

      <DialogActions>
        {footer || (
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose} variant="outlined">
              {isViewMode ? '닫기' : '취소'}
            </Button>

            {!isViewMode && onSubmit && (
              <LoadingButton onClick={onSubmit} variant="contained" loading={loading}>
                {mode === 'create' ? '생성' : '저장'}
              </LoadingButton>
            )}
          </Stack>
        )}
      </DialogActions>
    </Dialog>
  );
}
