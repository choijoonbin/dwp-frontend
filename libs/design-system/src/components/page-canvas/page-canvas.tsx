import type { PropsWithChildren } from 'react';

import Box from '@mui/material/Box';

import { foundationTokens } from '../../foundation';

export type PageCanvasMode = 'workspace' | 'focus';

export type PageCanvasProps = PropsWithChildren<{
  mode?: PageCanvasMode;
}>;

export function PageCanvas({ children, mode = 'workspace' }: PageCanvasProps) {
  const focused = mode === 'focus';

  return (
    <Box
      data-dwp-page-canvas={mode}
      sx={{
        width: '100%',
        minWidth: 0,
        maxWidth: focused ? foundationTokens.layout.focusCanvasMaxWidth : 'none',
        mx: focused ? 'auto' : 0,
        px: { xs: 2, md: 3, xl: 4 },
        py: { xs: 3, md: focused ? 5 : 4 },
      }}
    >
      {children}
    </Box>
  );
}
