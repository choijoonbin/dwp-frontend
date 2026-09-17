import { useCallback, useEffect, useId, useRef } from 'react';

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
  /** Optional exact desktop paper width while retaining full-screen mobile behavior. */
  desktopMaxWidth?: number | string;
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
  desktopMaxWidth,
  mobileFullScreen = false,
  showCancel = true,
  showSubmit = true,
}: FormDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const compact = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const coarsePointer = useMediaQuery('(pointer: coarse)', { noSsr: true });
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });
  const fullScreen = mobileFullScreen && compact;
  const touchActionTarget = compact || coarsePointer ? { minHeight: 44, minWidth: 44 } : undefined;
  const dialogRootRef = useRef<HTMLDivElement | null>(null);
  const lastExternalFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );

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

  const restoreExternalFocus = useCallback(() => {
    const target = lastExternalFocusRef.current;
    if (target?.isConnected && !target.matches(':disabled, [aria-disabled="true"]')) {
      target.focus({ preventScroll: true });
    }
  }, []);

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
      disableRestoreFocus
      transitionDuration={reducedMotion ? 0 : undefined}
      slotProps={{
        ...(desktopMaxWidth && !fullScreen ? { paper: { sx: { maxWidth: desktopMaxWidth } } } : {}),
        transition: { onExited: restoreExternalFocus },
      }}
      sx={{
        '@media (prefers-reduced-motion: reduce)': {
          '&, & *, & *::before, & *::after': {
            scrollBehavior: 'auto !important',
            transitionDuration: '0s !important',
            animationDuration: '0s !important',
            animationIterationCount: '1 !important',
          },
        },
      }}
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
          {secondaryActions && (
            <Box
              sx={{
                width: { xs: 1, sm: 'auto' },
                ...((compact || coarsePointer) && {
                  '& :is(button, a[href], [role="button"])': {
                    minWidth: 44,
                    minHeight: 44,
                  },
                }),
              }}
            >
              {secondaryActions}
            </Box>
          )}
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
              <ActionButton
                type="button"
                intent="quiet"
                onClick={onClose}
                disabled={busy}
                sx={touchActionTarget}
              >
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
                sx={touchActionTarget}
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
