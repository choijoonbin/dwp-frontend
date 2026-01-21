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
      p: 8,
      textAlign: 'center',
    }}
  >
    <Box
      sx={{
        mb: 3,
        borderRadius: '50%',
        bgcolor: 'action.selected',
        p: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Iconify icon="solar:shield-user-bold-duotone" width={48} sx={{ color: 'text.secondary' }} />
    </Box>
    <Typography variant="h5" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
      {title || '데이터가 없습니다'}
    </Typography>
    {description && (
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary', maxWidth: 400 }}>
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
