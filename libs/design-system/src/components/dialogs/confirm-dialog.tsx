import { useId } from 'react';
import { AlertTriangle, CircleHelp } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';

import { ActionButton } from '../actions';

export type ConfirmDialogIntent = 'primary' | 'danger';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmingLabel?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  intent?: ConfirmDialogIntent;
};

export function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmingLabel,
  onClose,
  onConfirm,
  busy = false,
  intent = 'primary',
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const destructive = intent === 'danger';

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={busy ? undefined : onClose}
      slotProps={{ paper: { role: destructive ? 'alertdialog' : 'dialog' } }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack direction="row" alignItems="flex-start" gap={1.5}>
          <Box
            aria-hidden="true"
            sx={{
              display: 'grid',
              placeItems: 'center',
              color: destructive ? 'error.main' : 'primary.main',
            }}
          >
            {destructive ? <AlertTriangle size={22} /> : <CircleHelp size={22} />}
          </Box>
          <Typography id={descriptionId} variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <ActionButton autoFocus intent="quiet" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </ActionButton>
        <ActionButton
          intent={destructive ? 'danger' : 'primary'}
          loading={busy}
          loadingLabel={confirmingLabel}
          onClick={() => void onConfirm()}
        >
          {confirmLabel}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}
