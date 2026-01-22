import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

// ----------------------------------------------------------------------

export type FilterBarProps = {
  controls?: ReactNode;
  actions?: ReactNode;
  spacing?: number;
};

export function FilterBar({ controls, actions, spacing = 2 }: FilterBarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        gap: spacing,
      }}
    >
      {controls && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={spacing}
          sx={{ flex: 1, minWidth: 0 }}
        >
          {controls}
        </Stack>
      )}

      {actions && (
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Box>
  );
}
