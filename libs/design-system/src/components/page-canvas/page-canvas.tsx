import type { PropsWithChildren } from 'react';

import Box from '@mui/material/Box';

import { foundationTokens } from '../../foundation';

export type PageCanvasMode = 'workspace' | 'focus';

export const PAGE_CANVAS_LAYOUT = {
  workspace: {
    maxWidth: 'none',
    marginInline: 0,
  },
  focus: {
    maxWidth: foundationTokens.layout.focusCanvasMaxWidth,
    marginInline: 'auto',
  },
} as const satisfies Record<
  PageCanvasMode,
  { maxWidth: number | 'none'; marginInline: number | 'auto' }
>;

export const PAGE_CANVAS_GUTTERS = { xs: 2, md: 3, xl: 4 } as const;

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
  const layout = PAGE_CANVAS_LAYOUT[mode];

  return (
    <Box
      data-dwp-page-canvas={mode}
      sx={{
        width: '100%',
        minWidth: 0,
        maxWidth: layout.maxWidth,
        mx: layout.marginInline,
        px: PAGE_CANVAS_GUTTERS,
        pt: { xs: compactTop ? 2 : 3, md: compactTop ? 2 : focused ? 5 : 4 },
        pb: { xs: 3, md: focused ? 5 : 4 },
      }}
    >
      {children}
    </Box>
  );
}
