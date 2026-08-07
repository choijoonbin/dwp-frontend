import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Logo, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';

import { AccountMenu } from '../components/account-menu';
import { LanguageMenu } from '../components/language-menu';
import {
  SearchControl,
  WorkspaceMenu,
  NotificationMenu,
} from '../components/shell-controls';

const NAV_WIDTH = 254;
const NAV_COLLAPSED_WIDTH = 80;
const HEADER_HEIGHT = 64;

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navWidth = collapsed ? NAV_COLLAPSED_WIDTH : NAV_WIDTH;

  const renderNavContent = (isCollapsed: boolean) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          height: HEADER_HEIGHT,
          px: isCollapsed ? 1.75 : 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
        }}
      >
        <Logo isSingle={false} collapsed={isCollapsed} />
      </Box>
      <Box component="nav" aria-label="Application navigation" sx={{ flex: 1 }} />
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box
        component="aside"
        data-testid="desktop-sidebar"
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          width: navWidth,
          zIndex: (theme) => theme.zIndex.drawer,
          display: { xs: 'none', lg: 'block' },
          position: 'fixed',
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          transition: (theme) => theme.transitions.create('width'),
        }}
      >
        {renderNavContent(collapsed)}
        <IconButton
          size="small"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => setCollapsed((value) => !value)}
          sx={{
            top: 32,
            right: -13,
            width: 26,
            height: 26,
            position: 'absolute',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            '&:hover': { bgcolor: 'background.neutral' },
          }}
        >
          <Iconify
            width={15}
            icon={collapsed ? 'solar:alt-arrow-right-bold' : 'solar:alt-arrow-left-bold'}
          />
        </IconButton>
      </Box>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { sx: { width: NAV_WIDTH } } }}
      >
        <Box data-testid="mobile-sidebar" sx={{ height: 1 }}>
          {renderNavContent(false)}
        </Box>
      </Drawer>

      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          width: { xs: 1, lg: `calc(100% - ${navWidth}px)` },
          ml: { xs: 0, lg: `${navWidth}px` },
          borderBottom: 1,
          borderColor: 'divider',
          transition: (theme) => theme.transitions.create(['width', 'margin-left']),
        }}
      >
        <Toolbar sx={{ minHeight: `${HEADER_HEIGHT}px !important`, px: { xs: 1.5, md: 2.5 } }}>
          <IconButton
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 1, display: { lg: 'none' } }}
          >
            <Iconify icon="solar:hamburger-menu-linear" width={22} />
          </IconButton>
          <WorkspaceMenu />
          <Box sx={{ flexGrow: 1 }} />
          <SearchControl />
          <LanguageMenu />
          <NotificationMenu />
          <AccountMenu />
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          pt: `${HEADER_HEIGHT}px`,
          ml: { xs: 0, lg: `${navWidth}px` },
          minHeight: '100dvh',
          transition: (theme) => theme.transitions.create('margin-left'),
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
