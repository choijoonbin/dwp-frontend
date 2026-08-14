import type { PropsWithChildren } from 'react';

import Box from '@mui/material/Box';

import { foundationTokens } from '../../foundation';

export type PageCanvasMode = 'workspace' | 'focus';

export type PageCanvasProps = PropsWithChildren<{
  mode?: PageCanvasMode;
  topInset?: 'standard' | 'compact';
}>;

export function PageCanvas({
  children,
  mode = 'workspace',
  topInset = 'standard',
}: PageCanvasProps) {
  const focused = mode === 'focus';
  const compactTop = topInset === 'compact';

  return (
    <Box
      data-dwp-page-canvas={mode}
      sx={{
        width: '100%',
        minWidth: 0,
        maxWidth: focused ? foundationTokens.layout.focusCanvasMaxWidth : 'none',
        mx: focused ? 'auto' : 0,
        px: { xs: 2, md: 3, xl: 4 },
        pt: { xs: compactTop ? 2 : 3, md: compactTop ? 2 : focused ? 5 : 4 },
        pb: { xs: 3, md: focused ? 5 : 4 },
      }}
    >
      {children}
    </Box>
  );
}
