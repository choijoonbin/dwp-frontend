import { useState } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { ProductMark, useAppearance } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { AccountMenu } from '../components/account-menu';
import { LanguageMenu } from '../components/language-menu';
import { SearchControl, WorkspaceMenu, NotificationMenu } from '../components/shell-controls';

const SIDEBAR_WIDTH = 248;
const RAIL_WIDTH = 72;
const HEADER_HEIGHT = 64;

export function AppLayout() {
  const appearance = useAppearance();
  const [collapsed, setCollapsed] = useState(appearance.navigationPattern === 'rail');
  const [mobileOpen, setMobileOpen] = useState(false);
  const topNavigation = appearance.navigationPattern === 'top';
  const compactSidebar = appearance.navigationPattern === 'rail' || collapsed;
  const sidebarWidth = compactSidebar ? RAIL_WIDTH : SIDEBAR_WIDTH;
  const desktopOffset = topNavigation ? 0 : sidebarWidth;

  const navigationContent = (compact: boolean) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          height: HEADER_HEIGHT,
          px: compact ? 2.5 : 2,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <ProductMark compact={compact} />
      </Box>
      <Box component="nav" aria-label="Application navigation" sx={{ flex: 1 }} />
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      {!topNavigation && (
        <Box
          component="aside"
          data-testid="desktop-sidebar"
          sx={{
            position: 'fixed',
            inset: '0 auto 0 0',
            width: sidebarWidth,
            zIndex: (theme) => theme.zIndex.drawer,
            display: { xs: 'none', lg: 'block' },
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
            transition: (theme) => theme.transitions.create('width'),
          }}
        >
          {navigationContent(compactSidebar)}
          {appearance.policy.navigation.allowCollapse &&
            appearance.navigationPattern !== 'rail' && (
              <Tooltip
                title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                placement="right"
              >
                <IconButton
                  size="small"
                  aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                  onClick={() => setCollapsed((current) => !current)}
                  sx={{
                    position: 'absolute',
                    top: 19,
                    right: -17,
                    width: 34,
                    height: 34,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {collapsed ? (
                    <PanelLeftOpen size={17} strokeWidth={1.8} />
                  ) : (
                    <PanelLeftClose size={17} strokeWidth={1.8} />
                  )}
                </IconButton>
              </Tooltip>
            )}
        </Box>
      )}

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH } } }}
      >
        <Box data-testid="mobile-sidebar" sx={{ height: 1 }}>
          {navigationContent(false)}
        </Box>
      </Drawer>

      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          width: { xs: 1, lg: `calc(100% - ${desktopOffset}px)` },
          ml: { xs: 0, lg: `${desktopOffset}px` },
          borderBottom: 1,
          borderColor: 'divider',
          transition: (theme) => theme.transitions.create(['width', 'margin-left']),
        }}
      >
        <Toolbar
          disableGutters
          sx={{ minHeight: `${HEADER_HEIGHT}px !important`, px: { xs: 1, md: 2 } }}
        >
          <IconButton
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 0.5, display: { lg: 'none' } }}
          >
            <Menu size={21} strokeWidth={1.8} />
          </IconButton>
          {topNavigation && (
            <ProductMark compact sx={{ mr: 1, display: { xs: 'none', lg: 'inline-flex' } }} />
          )}
          <WorkspaceMenu />
          <Box sx={{ flexGrow: 1 }} />
          <SearchControl />
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <LanguageMenu />
          </Box>
          <NotificationMenu />
          <AccountMenu />
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          pt: `${HEADER_HEIGHT}px`,
          ml: { xs: 0, lg: `${desktopOffset}px` },
          minHeight: '100dvh',
          transition: (theme) => theme.transitions.create('margin-left'),
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
