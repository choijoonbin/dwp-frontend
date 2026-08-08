import type { ReferenceLifecycle } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

const lifecycleColor = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  RETIRED: 'default',
} as const;

export function LifecycleChip({ state }: { state: ReferenceLifecycle }) {
  return (
    <Chip
      label={state.charAt(0) + state.slice(1).toLowerCase()}
      color={lifecycleColor[state]}
      variant={state === 'RETIRED' ? 'outlined' : 'filled'}
      size="small"
    />
  );
}

export function AdminPanelLoading({ label }: { label: string }) {
  return (
    <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress size={26} aria-label={label} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

export function AdminPanelError({ message }: { message: string }) {
  return (
    <Box
      role="alert"
      sx={{ minHeight: 260, display: 'grid', placeItems: 'center', textAlign: 'center', px: 3 }}
    >
      <Box>
        <Typography variant="subtitle1">Unable to load administration data</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {message}
        </Typography>
      </Box>
    </Box>
  );
}
