import { useState } from 'react';
import {
  Activity as ActivityIcon,
  AppWindow,
  BriefcaseBusiness,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { foundationTokens, useAppearance } from '@dwp-frontend/design-system';
import { usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { AccountMenu } from '../components/account-menu';
import { BrandLockup } from '../components/brand-lockup';
import { LanguageMenu } from '../components/language-menu';
import { SearchControl, WorkspaceMenu, NotificationMenu } from '../components/shell-controls';
import { isAppResourceEntitled } from '../features/home/app-launchpad-model';

const SIDEBAR_WIDTH = foundationTokens.layout.navigationExpanded;
const RAIL_WIDTH = foundationTokens.layout.navigationCompact;
const HEADER_HEIGHT = foundationTokens.layout.headerHeight;

const navigationItems = [
  { label: 'Work', path: '/work', icon: BriefcaseBusiness, resourceKey: 'APP.WORK' },
  { label: 'Ask', path: '/ask', icon: Sparkles, resourceKey: 'APP.ASK' },
  { label: 'Activity', path: '/activity', icon: ActivityIcon, resourceKey: 'APP.ACTIVITY' },
  { label: 'Apps', path: '/apps', icon: AppWindow },
] as const;

type AppNavigationProps = {
  compact?: boolean;
  horizontal?: boolean;
  onNavigate?: () => void;
};

function AppNavigation({ compact = false, horizontal = false, onNavigate }: AppNavigationProps) {
  const { pathname } = useLocation();
  const { permissions } = usePermissions();
  const visibleNavigationItems = navigationItems.filter(
    (item) => !('resourceKey' in item) || isAppResourceEntitled(item.resourceKey, permissions)
  );

  return (
    <Box component="nav" aria-label="Application navigation" sx={{ minWidth: 0 }}>
      {!compact && !horizontal && (
        <Typography
          component="p"
          variant="overline"
          color="text.secondary"
          sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}
        >
          Workspace
        </Typography>
      )}
      <List
        disablePadding
        sx={{
          display: horizontal ? 'flex' : 'grid',
          gap: 0.5,
          px: horizontal ? 0 : 1,
        }}
      >
        {visibleNavigationItems.map((item) => {
          const selected = pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Tooltip
              key={item.path}
              title={compact ? item.label : ''}
              placement="right"
              disableInteractive={!compact}
            >
              <ListItem disablePadding sx={{ width: horizontal ? 'auto' : 1 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  selected={selected}
                  aria-current={selected ? 'page' : undefined}
                  onClick={onNavigate}
                  sx={{
                    minHeight: 44,
                    justifyContent: compact ? 'center' : 'flex-start',
                    px: compact ? 1 : 1.5,
                    whiteSpace: 'nowrap',
                    position: 'relative',
                    borderRadius: 1,
                    color: selected ? 'text.primary' : 'text.secondary',
                    '& .MuiListItemText-primary': {
                      fontWeight: selected ? 700 : 600,
                    },
                    '&.Mui-selected': {
                      bgcolor: 'action.selected',
                      color: 'primary.main',
                    },
                    '&.Mui-selected::before': {
                      content: '""',
                      position: 'absolute',
                      left: compact ? 3 : 0,
                      width: 3,
                      height: 22,
                      borderRadius: 1,
                      bgcolor: 'primary.main',
                    },
                    '&.Mui-selected:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: compact ? 0 : 36,
                      justifyContent: 'center',
                      color: 'inherit',
                    }}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  </ListItemIcon>
                  {!compact && <ListItemText primary={item.label} />}
                </ListItemButton>
              </ListItem>
            </Tooltip>
          );
        })}
      </List>
    </Box>
  );
}

export function AppLayout() {
  const appearance = useAppearance();
  const [collapsed, setCollapsed] = useState(appearance.navigationPattern === 'rail');
  const [mobileOpen, setMobileOpen] = useState(false);
  const topNavigation = appearance.navigationPattern === 'top';
  const compactSidebar = appearance.navigationPattern === 'rail' || collapsed;
  const sidebarWidth = compactSidebar ? RAIL_WIDTH : SIDEBAR_WIDTH;
  const desktopOffset = topNavigation ? 0 : sidebarWidth;
  const desktopNavigationCollapsible =
    appearance.policy.navigation.allowCollapse && appearance.navigationPattern !== 'rail';

  const navigationContent = (compact: boolean, onNavigate?: () => void) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          height: HEADER_HEIGHT,
          px: compact ? 0 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'flex-start',
        }}
      >
        <BrandLockup variant={compact ? 'product-only' : 'product-full'} sx={{ flexShrink: 0 }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <AppNavigation compact={compact} onNavigate={onNavigate} />
      </Box>
      <Box
        sx={{
          mx: compact ? 1 : 1.5,
          mb: 1.5,
          pt: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'flex-start',
          gap: 1,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }}
        />
        {!compact && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" fontWeight={700}>
              Workspace connected
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              4 sources / policy healthy
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box
      data-dwp-navigation-state={topNavigation ? 'top' : compactSidebar ? 'compact' : 'expanded'}
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      {!topNavigation && (
        <Box
          component="aside"
          id="desktop-navigation"
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
        </Box>
      )}

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH } } }}
      >
        <Box data-testid="mobile-sidebar" sx={{ height: 1 }}>
          {navigationContent(false, () => setMobileOpen(false))}
        </Box>
      </Drawer>

      <AppBar
        data-testid="app-header"
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          width: { xs: 1, lg: `calc(100% - ${desktopOffset}px)` },
          ml: { xs: 0, lg: `${desktopOffset}px` },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
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
          {!topNavigation && desktopNavigationCollapsible && (
            <Tooltip
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              placement="bottom"
            >
              <IconButton
                size="small"
                aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                aria-controls="desktop-navigation"
                aria-expanded={!collapsed}
                onClick={() => setCollapsed((current) => !current)}
                sx={{
                  mr: 0.5,
                  width: 40,
                  height: 40,
                  display: { xs: 'none', lg: 'inline-flex' },
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                {collapsed ? (
                  <PanelLeftOpen size={18} strokeWidth={1.8} />
                ) : (
                  <PanelLeftClose size={18} strokeWidth={1.8} />
                )}
              </IconButton>
            </Tooltip>
          )}
          {topNavigation && (
            <BrandLockup
              variant="product-full"
              sx={{ mr: 1, display: { xs: 'none', lg: 'inline-flex' } }}
            />
          )}
          <WorkspaceMenu />
          {topNavigation && (
            <Box sx={{ ml: 1.5, display: { xs: 'none', lg: 'block' } }}>
              <AppNavigation horizontal />
            </Box>
          )}
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

      <Box
        component="main"
        data-testid="app-main"
        sx={{
          pt: `${HEADER_HEIGHT}px`,
          width: { xs: 1, lg: `calc(100% - ${desktopOffset}px)` },
          ml: { xs: 0, lg: `${desktopOffset}px` },
          minWidth: 0,
          minHeight: '100dvh',
          overflowX: 'clip',
          transition: (theme) => theme.transitions.create(['width', 'margin-left']),
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
