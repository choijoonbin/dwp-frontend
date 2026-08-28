import { useEffect, useId, useRef } from 'react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

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
  mobileFullScreen?: boolean;
  showCancel?: boolean;
  showSubmit?: boolean;
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
  mobileFullScreen = false,
  showCancel = true,
  showSubmit = true,
}: FormDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const compact = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const fullScreen = mobileFullScreen && compact;
  const dialogRootRef = useRef<HTMLDivElement | null>(null);
  const lastExternalFocusRef = useRef<HTMLElement | null>(null);
  const previousOpenRef = useRef(open);

  useEffect(() => {
    if (open) return undefined;
    const rememberExternalFocus = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        target === document.body ||
        target === document.documentElement ||
        dialogRootRef.current?.contains(target)
      ) {
        return;
      }
      lastExternalFocusRef.current = target;
    };
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      if (
        activeElement !== document.body &&
        activeElement !== document.documentElement &&
        !dialogRootRef.current?.contains(activeElement)
      ) {
        lastExternalFocusRef.current = activeElement;
      }
    }
    document.addEventListener('focusin', rememberExternalFocus, true);
    return () => document.removeEventListener('focusin', rememberExternalFocus, true);
  }, [open]);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;
    if (!wasOpen || open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = lastExternalFocusRef.current;
      const activeElement = document.activeElement;
      const focusNeedsRestoring =
        activeElement === null ||
        activeElement === document.body ||
        activeElement === document.documentElement ||
        (activeElement instanceof HTMLElement && dialogRootRef.current?.contains(activeElement));
      if (
        focusNeedsRestoring &&
        target?.isConnected &&
        !target.matches(':disabled, [aria-disabled="true"]')
      ) {
        target.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Dialog
      ref={dialogRootRef}
      open={open}
      fullWidth
      fullScreen={fullScreen}
      maxWidth={maxWidth}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={busy ? undefined : onClose}
    >
      <Box
        component="form"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          maxHeight: fullScreen ? '100dvh' : 'calc(100dvh - 64px)',
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !submitDisabled) void onSubmit();
        }}
      >
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <DialogContent tabIndex={0} sx={{ minHeight: 0, overflowY: 'auto', pt: '8px !important' }}>
          {description && (
            <Typography id={descriptionId} variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {description}
            </Typography>
          )}
          {children}
        </DialogContent>
        <DialogActions
          sx={{
            flex: '0 0 auto',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: secondaryActions ? 'space-between' : 'flex-end',
          }}
        >
          {secondaryActions && <Box sx={{ width: { xs: 1, sm: 'auto' } }}>{secondaryActions}</Box>}
          <Box
            sx={{
              width: { xs: 1, sm: 'auto' },
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              '& > *': { flex: { xs: '1 1 120px', sm: '0 0 auto' } },
            }}
          >
            {showCancel && (
              <ActionButton intent="quiet" onClick={onClose} disabled={busy}>
                {cancelLabel}
              </ActionButton>
            )}
            {showSubmit && (
              <ActionButton
                type="submit"
                intent={submitIntent}
                loading={busy}
                loadingLabel={submittingLabel}
                disabled={submitDisabled}
              >
                {submitLabel}
              </ActionButton>
            )}
          </Box>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
