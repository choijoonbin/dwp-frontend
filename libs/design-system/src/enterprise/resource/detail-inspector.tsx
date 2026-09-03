import { useEffect, useId, useRef } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, ActionIconButton } from '../../components/actions';

export type DetailInspectorProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
  variant?: 'inline' | 'drawer';
  width?: number;
  previousLabel?: string;
  nextLabel?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  deepLinkLabel?: string;
  onDeepLink?: () => void;
  status?: React.ReactNode;
};

export function DetailInspector({
  open,
  title,
  subtitle,
  children,
  onClose,
  closeLabel,
  variant = 'inline',
  width = 360,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
  deepLinkLabel,
  onDeepLink,
  status,
}: DetailInspectorProps) {
  const titleId = useId();
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) returnFocusRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const close = () => {
    onClose();
    globalThis.requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  const content = (
    <Box
      component="aside"
      aria-label={title}
      sx={{
        width: variant === 'drawer' ? { xs: '100vw', sm: width } : 1,
        minWidth: 0,
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={2}
        sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={titleId} component="h2" variant="h6">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Stack direction="row" alignItems="center" gap={0.25}>
          {onPrevious && previousLabel && (
            <ActionIconButton
              label={previousLabel}
              tooltip={previousLabel}
              onClick={onPrevious}
              disabled={previousDisabled}
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </ActionIconButton>
          )}
          {onNext && nextLabel && (
            <ActionIconButton
              label={nextLabel}
              tooltip={nextLabel}
              onClick={onNext}
              disabled={nextDisabled}
            >
              <ChevronRight size={17} aria-hidden="true" />
            </ActionIconButton>
          )}
          <ActionIconButton label={closeLabel} tooltip={closeLabel} onClick={close}>
            <X size={17} aria-hidden="true" />
          </ActionIconButton>
        </Stack>
      </Stack>
      {(status || (deepLinkLabel && onDeepLink)) && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ px: 2.5, py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          {status ?? <Box />}
          {deepLinkLabel && onDeepLink && (
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ExternalLink size={15} />}
              onClick={onDeepLink}
            >
              {deepLinkLabel}
            </ActionButton>
          )}
        </Stack>
      )}
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Box>
  );

  if (variant === 'drawer') {
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={close}
        slotProps={{ paper: { 'aria-labelledby': titleId, sx: { maxWidth: '100%' } } }}
      >
        {content}
      </Drawer>
    );
  }
  return open ? content : null;
}
