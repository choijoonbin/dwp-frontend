// ----------------------------------------------------------------------

import { memo } from 'react';

import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

// ----------------------------------------------------------------------

type DeleteConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onConfirm: () => void;
};

export const DeleteConfirmDialog = memo(({ open, onClose, title, content, onConfirm }: DeleteConfirmDialogProps) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <Typography variant="body2">{content}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>취소</Button>
      <Button variant="contained" color="error" onClick={onConfirm}>
        삭제
      </Button>
    </DialogActions>
  </Dialog>
));

DeleteConfirmDialog.displayName = 'DeleteConfirmDialog';
