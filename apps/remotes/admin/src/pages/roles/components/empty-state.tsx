// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type EmptyStateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const EmptyState = memo(({ title, description, actionLabel, onAction }: EmptyStateProps) => (
  <Box
    sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 4,
      textAlign: 'center',
    }}
  >
    <Box
      sx={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mx: 'auto',
        mb: 2,
      }}
    >
      <Iconify icon="solar:shield-user-bold-duotone" width={28} sx={{ color: 'text.disabled' }} />
    </Box>
    <Typography variant="h6" sx={{ mb: 1 }}>
      {title || '데이터가 없습니다'}
    </Typography>
    {description && (
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        {description}
      </Typography>
    )}
    {onAction && actionLabel && (
      <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </Box>
));

EmptyState.displayName = 'EmptyState';
