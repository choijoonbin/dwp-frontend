import { PageCanvas } from '@dwp-frontend/design-system/components/page-canvas';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';

import type { ReactNode } from 'react';
import type { Theme } from '@mui/material/styles';

export const NOTIFICATION_PAGE_FRAME_TEST_ID = 'notification-page-frame';

function notificationWorkspaceTheme(theme: Theme): Theme {
  return {
    ...theme,
    shape: { ...theme.shape, borderRadius: foundationTokens.radius.surface },
    typography: {
      ...theme.typography,
      h5: {
        ...theme.typography.h5,
        fontSize: theme.typography.h4.fontSize,
        lineHeight: theme.typography.h4.lineHeight,
      },
      h6: {
        ...theme.typography.h6,
        fontSize: theme.typography.h5.fontSize,
        lineHeight: theme.typography.h5.lineHeight,
      },
      body2: {
        ...theme.typography.body2,
        fontSize: theme.typography.pxToRem(theme.typography.fontSize - 1),
      },
      button: {
        ...theme.typography.button,
        fontSize: theme.typography.pxToRem(theme.typography.fontSize - 1),
      },
    },
  };
}

export function NotificationPageFrame({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={notificationWorkspaceTheme}>
      <PageCanvas mode="workspace" topInset="compact">
        <Box
          data-testid={NOTIFICATION_PAGE_FRAME_TEST_ID}
          data-notification-page-frame
          sx={{
            width: 1,
            minWidth: 0,
            mx: 0,
            '--notification-panel-shadow': 'none',
          }}
        >
          {children}
        </Box>
      </PageCanvas>
    </ThemeProvider>
  );
}
