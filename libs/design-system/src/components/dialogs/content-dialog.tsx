import { useId } from 'react';
import { X } from 'lucide-react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';

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
  contentTabIndex?: number;
  slotProps?: DialogProps['slotProps'];
  testId?: string;
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
  contentTabIndex,
  slotProps,
  testId,
}: ContentDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      fullScreen={fullScreen}
      fullWidth
      maxWidth={maxWidth}
      aria-labelledby={titleId}
      aria-describedby={!hideHeader && description ? descriptionId : undefined}
      onClose={busy ? undefined : onClose}
      slotProps={slotProps}
      data-testid={testId}
    >
      {hideHeader ? (
        <Box component="span" id={titleId} sx={visuallyHidden}>
          {title}
        </Box>
      ) : (
        <DialogTitle
          component="div"
          id={`${titleId}-container`}
          sx={{ minHeight: 72, display: 'flex', alignItems: 'center', gap: 2, pr: 1.5 }}
        >
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
      <DialogContent dividers={contentDividers} sx={contentSx} tabIndex={contentTabIndex}>
        {children}
      </DialogContent>
      {footerContent && <DialogActions sx={footerSx}>{footerContent}</DialogActions>}
    </Dialog>
  );
}
