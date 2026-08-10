import { Outlet } from 'react-router-dom';
import { ProductMark, foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';

import { AccountMenu } from '../components/account-menu';
import { LanguageMenu } from '../components/language-menu';
import { NotificationMenu, SearchControl, WorkspaceMenu } from '../components/shell-controls';

const HEADER_HEIGHT = foundationTokens.layout.headerHeight;

export function HomeLayout() {
  return (
    <Box
      data-testid="personal-home-shell"
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      <AppBar
        data-testid="home-header"
        position="sticky"
        color="default"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            width: 1,
            maxWidth: 1600,
            minHeight: `${HEADER_HEIGHT}px !important`,
            mx: 'auto',
            px: { xs: 1.5, md: 3 },
          }}
        >
          <ProductMark compact sx={{ display: { xs: 'inline-flex', sm: 'none' } }} />
          <ProductMark sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
          <Box sx={{ ml: { xs: 0.5, md: 2 }, display: { xs: 'none', md: 'block' } }}>
            <WorkspaceMenu />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <SearchControl />
          <Box
            sx={{
              ml: { xs: 0, md: 1.5 },
              pl: { xs: 0, md: 1 },
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.25, sm: 0.5 },
            }}
          >
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <LanguageMenu />
            </Box>
            <NotificationMenu />
          </Box>
          <Box
            sx={{
              ml: { xs: 0.5, sm: 1.25 },
              pl: { xs: 0.5, sm: 1.5 },
              borderLeft: 1,
              borderColor: 'divider',
            }}
          >
            <AccountMenu showIdentity />
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" data-testid="personal-home-main" sx={{ minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
