import type { ReactNode } from 'react';

import Box from '@mui/material/Box';

// ----------------------------------------------------------------------

export type TwoColumnLayoutProps = {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: number;
  minRightWidth?: number;
  stickyHeader?: boolean;
  mode?: 'fixed' | 'scrollable';
};

export function TwoColumnLayout({
  left,
  right,
  leftWidth = 320,
  minRightWidth = 520,
  stickyHeader = false,
  mode = 'scrollable',
}: TwoColumnLayoutProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        height: mode === 'fixed' ? '100%' : 'auto',
      }}
    >
      <Box
        sx={{
          width: { xs: '100%', md: leftWidth },
          flexShrink: 0,
          ...(mode === 'fixed' && {
            height: '100%',
            overflow: 'hidden',
          }),
        }}
      >
        {left}
      </Box>

      <Box
        sx={{
          flex: 1,
          minWidth: { xs: '100%', md: minRightWidth },
          ...(mode === 'fixed' && {
            height: '100%',
            overflow: 'hidden',
          }),
        }}
      >
        {right}
      </Box>
    </Box>
  );
}
