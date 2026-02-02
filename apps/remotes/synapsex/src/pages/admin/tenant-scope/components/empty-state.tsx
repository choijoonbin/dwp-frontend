import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

type EmptyStateProps = {
  message?: string;
  onSeed?: () => void;
  seedLabel?: string;
};

export const EmptyState = ({
  message = 'No scope configured yet.',
  onSeed,
  seedLabel = 'Seed defaults',
}: EmptyStateProps) => (
  <Box
    sx={{
      py: 6,
      px: 2,
      textAlign: 'center',
      borderRadius: 1,
      border: 1,
      borderColor: 'divider',
      bgcolor: 'action.hover',
    }}
  >
    <Iconify
      icon="solar:database-outline"
      width={48}
      sx={{ color: 'text.disabled', mb: 1 }}
    />
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      {message}
    </Typography>
    {onSeed && (
      <Button variant="outlined" size="small" onClick={onSeed}>
        {seedLabel}
      </Button>
    )}
  </Box>
);
