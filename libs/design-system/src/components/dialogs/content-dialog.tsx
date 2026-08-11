import { useId } from 'react';
import { X } from 'lucide-react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';

import { ActionIconButton } from '../actions';

import type { DialogProps } from '@mui/material/Dialog';
import type { SxProps, Theme } from '@mui/material/styles';

export type ContentDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
  maxWidth?: DialogProps['maxWidth'];
  headerContent?: React.ReactNode;
  contentSx?: SxProps<Theme>;
  slotProps?: DialogProps['slotProps'];
};

export function ContentDialog({
  open,
  title,
  description,
  closeLabel,
  onClose,
  children,
  busy = false,
  maxWidth = 'sm',
  headerContent,
  contentSx,
  slotProps,
}: ContentDialogProps) {
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
      slotProps={slotProps}
    >
      <DialogTitle sx={{ minHeight: 72, display: 'flex', alignItems: 'center', gap: 2, pr: 1.5 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id={titleId} component="h2" variant="h6">
            {title}
          </Typography>
          {description && (
            <Typography id={descriptionId} variant="caption" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
        <ActionIconButton
          label={closeLabel}
          onClick={onClose}
          disabled={busy}
          tooltipPlacement="left"
        >
          <X size={19} />
        </ActionIconButton>
      </DialogTitle>
      {headerContent}
      <DialogContent sx={contentSx}>{children}</DialogContent>
    </Dialog>
  );
}
