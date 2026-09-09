import { useId, useRef, type ReactNode } from 'react';
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
  details?: ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  intent?: ConfirmDialogIntent;
  focusCancelAfterOpen?: boolean;
  minimumActionHeight?: number;
  keepTitleWords?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmingLabel,
  details,
  onClose,
  onConfirm,
  busy = false,
  intent = 'primary',
  focusCancelAfterOpen = false,
  minimumActionHeight,
  keepTitleWords = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
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
      slotProps={{
        paper: { role: destructive ? 'alertdialog' : 'dialog' },
        transition: {
          onEntered: () => {
            if (focusCancelAfterOpen) cancelRef.current?.focus();
          },
        },
      }}
    >
      <DialogTitle
        id={titleId}
        sx={
          keepTitleWords
            ? { wordBreak: 'keep-all', overflowWrap: 'normal', textWrap: 'balance' }
            : undefined
        }
      >
        {title}
      </DialogTitle>
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
        {details ? <Box sx={{ mt: 2 }}>{details}</Box> : null}
      </DialogContent>
      <DialogActions>
        <ActionButton
          ref={cancelRef}
          autoFocus
          intent="quiet"
          onClick={onClose}
          disabled={busy}
          sx={minimumActionHeight === undefined ? undefined : { minHeight: minimumActionHeight }}
        >
          {cancelLabel}
        </ActionButton>
        <ActionButton
          intent={destructive ? 'danger' : 'primary'}
          loading={busy}
          loadingLabel={confirmingLabel}
          onClick={() => void onConfirm()}
          sx={minimumActionHeight === undefined ? undefined : { minHeight: minimumActionHeight }}
        >
          {confirmLabel}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}
