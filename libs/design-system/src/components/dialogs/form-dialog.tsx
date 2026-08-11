import { useId } from 'react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';

import { ActionButton } from '../actions';

import type { ActionIntent } from '../actions';
import type { DialogProps } from '@mui/material/Dialog';

export type FormDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  cancelLabel: string;
  submitLabel: string;
  submittingLabel?: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  busy?: boolean;
  submitDisabled?: boolean;
  submitIntent?: ActionIntent;
  secondaryActions?: React.ReactNode;
  maxWidth?: DialogProps['maxWidth'];
};

export function FormDialog({
  open,
  title,
  description,
  children,
  cancelLabel,
  submitLabel,
  submittingLabel,
  onClose,
  onSubmit,
  busy = false,
  submitDisabled = false,
  submitIntent = 'primary',
  secondaryActions,
  maxWidth = 'sm',
}: FormDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth={maxWidth}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={busy ? undefined : onClose}
    >
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !submitDisabled) void onSubmit();
        }}
      >
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {description && (
            <Typography id={descriptionId} variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {description}
            </Typography>
          )}
          {children}
        </DialogContent>
        <DialogActions sx={{ justifyContent: secondaryActions ? 'space-between' : 'flex-end' }}>
          {secondaryActions && <Box>{secondaryActions}</Box>}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <ActionButton intent="quiet" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </ActionButton>
            <ActionButton
              type="submit"
              intent={submitIntent}
              loading={busy}
              loadingLabel={submittingLabel}
              disabled={submitDisabled}
            >
              {submitLabel}
            </ActionButton>
          </Box>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
