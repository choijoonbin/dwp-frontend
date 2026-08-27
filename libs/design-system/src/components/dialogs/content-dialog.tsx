import { useId } from 'react';
import { X } from 'lucide-react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
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
  fullScreen?: boolean;
  hideHeader?: boolean;
  maxWidth?: DialogProps['maxWidth'];
  titleStart?: React.ReactNode;
  titleEnd?: React.ReactNode;
  closeButtonSx?: SxProps<Theme>;
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
  footerSx?: SxProps<Theme>;
  contentDividers?: boolean;
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
  fullScreen = false,
  hideHeader = false,
  maxWidth = 'sm',
  titleStart,
  titleEnd,
  closeButtonSx,
  headerContent,
  footerContent,
  footerSx,
  contentDividers = false,
  contentSx,
  slotProps,
}: ContentDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      fullScreen={fullScreen}
      fullWidth
      maxWidth={maxWidth}
      aria-label={hideHeader ? title : undefined}
      aria-labelledby={hideHeader ? undefined : titleId}
      aria-describedby={!hideHeader && description ? descriptionId : undefined}
      onClose={busy ? undefined : onClose}
      slotProps={slotProps}
    >
      {!hideHeader && (
        <DialogTitle sx={{ minHeight: 72, display: 'flex', alignItems: 'center', gap: 2, pr: 1.5 }}>
          {titleStart}
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
          {titleEnd}
          <ActionIconButton
            label={closeLabel}
            onClick={onClose}
            disabled={busy}
            tooltipPlacement="left"
            sx={closeButtonSx}
          >
            <X size={19} />
          </ActionIconButton>
        </DialogTitle>
      )}
      {headerContent}
      <DialogContent dividers={contentDividers} sx={contentSx}>
        {children}
      </DialogContent>
      {footerContent && <DialogActions sx={footerSx}>{footerContent}</DialogActions>}
    </Dialog>
  );
}
