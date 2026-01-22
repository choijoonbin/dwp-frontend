import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

// ----------------------------------------------------------------------

export type ToolbarActionsProps = {
  left?: ReactNode;
  right?: ReactNode;
  spacing?: number;
};

export function ToolbarActions({ left, right, spacing = 1 }: ToolbarActionsProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: spacing,
      }}
    >
      {left && (
        <Stack direction="row" spacing={spacing} sx={{ flexWrap: 'wrap', gap: spacing }}>
          {left}
        </Stack>
      )}

      {right && (
        <Stack direction="row" spacing={spacing} sx={{ flexWrap: 'wrap', gap: spacing }}>
          {right}
        </Stack>
      )}
    </Box>
  );
}
