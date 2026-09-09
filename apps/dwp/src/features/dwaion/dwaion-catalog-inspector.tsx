import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

export function CatalogInspector({
  open,
  title,
  closeLabel,
  emptyLabel,
  onClose,
  onClosed,
  children,
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  emptyLabel: string;
  onClose: () => void;
  onClosed: () => void;
  children: ReactNode;
}) {
  const wide = useMediaQuery(useTheme().breakpoints.up('lg'));
  const content = (
    <Stack gap={2.5} sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, overflowWrap: 'anywhere' }}>
      <Stack direction="row" gap={1} justifyContent="space-between" alignItems="center">
        <Typography variant="overline" sx={{ minWidth: 0 }}>
          {title}
        </Typography>
        <ActionIconButton
          label={closeLabel}
          onClick={() => {
            onClose();
            if (wide) onClosed();
          }}
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <X size={18} aria-hidden="true" />
        </ActionIconButton>
      </Stack>
      {children}
    </Stack>
  );
  if (!wide)
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        ModalProps={{ disableRestoreFocus: true }}
        slotProps={{
          transition: { onExited: onClosed },
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-label': title,
            sx: {
              width: { xs: '100%', sm: 560 },
              maxWidth: '100vw',
              pb: 'env(safe-area-inset-bottom)',
            },
          },
        }}
      >
        {content}
      </Drawer>
    );
  return (
    <Box
      component="aside"
      aria-label={title}
      sx={{
        minWidth: 0,
        alignSelf: 'start',
        bgcolor: 'action.hover',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
      }}
    >
      {open ? (
        content
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
          {emptyLabel}
        </Typography>
      )}
    </Box>
  );
}

export function CatalogSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section">
      <Typography component="h3" variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function CatalogTerm({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(100px, 1fr) minmax(0, 2fr)' },
        gap: 0.5,
      }}
    >
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}
