import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Home, Menu, ShieldCheck } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { foundationTokens } from '@dwp-frontend/design-system';
import { useAuth, usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { AccountMenu } from '../components/account-menu';
import { BrandLockup } from '../components/brand-lockup';
import {
  FullscreenControl,
  NotificationMenu,
  SearchControl,
  WorkspaceMenu,
} from '../components/shell-controls';
import {
  ADMIN_NAVIGATION,
  type AdminNavigationGroup,
  type AdminSection,
} from '../features/admin/admin-navigation';

const SIDEBAR_WIDTH = foundationTokens.layout.adminNavigationExpanded;
const HEADER_HEIGHT = foundationTokens.layout.headerHeight;

type AdminNavigationProps = {
  onNavigate?: () => void;
};

function initialExpandedGroups(): Record<AdminSection, boolean> {
  return ADMIN_NAVIGATION.reduce(
    (groups, group) => ({ ...groups, [group.id]: false }),
    {} as Record<AdminSection, boolean>
  );
}

function AdminNavigation({ onNavigate }: AdminNavigationProps) {
  const { t } = useTranslation('admin');
  const { hasPermission, isLoaded } = usePermissions();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(initialExpandedGroups);
  const activeGroup = useMemo(
    () => ADMIN_NAVIGATION.find((group) => group.items.some((item) => item.path === pathname)),
    [pathname]
  );

  useEffect(() => {
    if (!activeGroup) return;
    setExpanded((current) => ({ ...current, [activeGroup.id]: true }));
  }, [activeGroup]);

  const toggleGroup = (group: AdminNavigationGroup) => {
    setExpanded((current) => ({ ...current, [group.id]: !current[group.id] }));
  };

  return (
    <Box component="nav" aria-label={t('shell.navigationLabel')} sx={{ py: 1.5 }}>
      <List disablePadding sx={{ display: 'grid', gap: 0.5, px: 1.25 }}>
        {ADMIN_NAVIGATION.map((group) => {
          const GroupIcon = group.icon;
          const groupExpanded = expanded[group.id];
          const groupActive = group.items.some((item) => item.path === pathname);
          const regionId = `admin-navigation-${group.id}`;

          return (
            <Box component="li" key={group.id} sx={{ display: 'block' }}>
              <ListItemButton
                aria-controls={regionId}
                aria-expanded={groupExpanded}
                onClick={() => toggleGroup(group)}
                sx={{
                  minHeight: 42,
                  px: 1.25,
                  borderRadius: 1,
                  color: groupActive ? 'text.primary' : 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                  <GroupIcon size={18} strokeWidth={1.8} aria-hidden="true" />
                </ListItemIcon>
                <ListItemText
                  primary={t(`navigation.groups.${group.id}`)}
                  primaryTypographyProps={{
                    variant: 'subtitle2',
                    fontWeight: groupActive ? 750 : 650,
                  }}
                />
                <ChevronDown
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  style={{
                    transform: groupExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 160ms ease',
                  }}
                />
              </ListItemButton>

              <Collapse in={groupExpanded} timeout="auto" unmountOnExit>
                <List
                  id={regionId}
                  disablePadding
                  sx={{
                    ml: 2.35,
                    pl: 1.15,
                    borderLeft: 1,
                    borderColor: 'divider',
                    display: 'grid',
                    gap: 0.25,
                  }}
                >
                  {group.items
                    .filter(
                      (item) =>
                        !item.requiredResourceKey ||
                        (isLoaded &&
                          hasPermission(item.requiredResourceKey, item.requiredPermissionCode))
                    )
                    .map((item) => {
                      const ItemIcon = item.icon;
                      const selected = pathname === item.path;
                      return (
                        <Box component="li" key={item.path} sx={{ display: 'block' }}>
                          <ListItemButton
                            component={NavLink}
                            to={item.path}
                            selected={selected}
                            aria-current={selected ? 'page' : undefined}
                            onClick={onNavigate}
                            sx={{
                              minHeight: 40,
                              px: 1.15,
                              borderRadius: 1,
                              color: selected ? 'primary.main' : 'text.secondary',
                              '&.Mui-selected': { bgcolor: 'action.selected' },
                              '&.Mui-selected:hover': { bgcolor: 'action.selected' },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 30, color: 'inherit' }}>
                              <ItemIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                            </ListItemIcon>
                            <ListItemText
                              primary={t(`navigation.items.${item.view}.label`)}
                              primaryTypographyProps={{
                                variant: 'body2',
                                fontWeight: selected ? 750 : 550,
                              }}
                            />
                          </ListItemButton>
                        </Box>
                      );
                    })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </List>
    </Box>
  );
}

export function AdminLayout() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const tenantName = auth.user?.tenantName || auth.user?.tenantCode || t('shell.tenantFallback');

  const navigationContent = (onNavigate?: () => void) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          minHeight: HEADER_HEIGHT,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}
      >
        <BrandLockup
          variant="product-full"
          label={t('shell.controlCenter')}
          description={t('shell.productName')}
          sx={{ flexShrink: 0 }}
        />
      </Box>

      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 0.75 }}>
        <Typography component="p" variant="overline" color="text.secondary">
          {t('shell.tenantAdministration')}
        </Typography>
        <Typography variant="body2" fontWeight={700} noWrap>
          {tenantName}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <AdminNavigation onNavigate={onNavigate} />
      </Box>

      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button
          component={NavLink}
          to="/"
          fullWidth
          color="inherit"
          startIcon={<Home size={17} strokeWidth={1.8} />}
          onClick={onNavigate}
          sx={{ justifyContent: 'flex-start' }}
        >
          {t('shell.backToWorkspace')}
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box data-testid="admin-shell" sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box
        component="aside"
        data-testid="admin-sidebar"
        sx={{
          position: 'fixed',
          inset: '0 auto 0 0',
          width: SIDEBAR_WIDTH,
          zIndex: (theme) => theme.zIndex.drawer,
          display: { xs: 'none', lg: 'block' },
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        {navigationContent()}
      </Box>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH } } }}
      >
        <Box data-testid="admin-mobile-sidebar" sx={{ height: 1 }}>
          {navigationContent(() => setMobileOpen(false))}
        </Box>
      </Drawer>

      <AppBar
        data-testid="admin-header"
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          width: { xs: 1, lg: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          ml: { xs: 0, lg: `${SIDEBAR_WIDTH}px` },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar
          disableGutters
          sx={{ minHeight: `${HEADER_HEIGHT}px !important`, px: { xs: 1, md: 2 } }}
        >
          <IconButton
            aria-label={t('shell.openNavigation')}
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 0.5, display: { lg: 'none' } }}
          >
            <Menu size={21} strokeWidth={1.8} />
          </IconButton>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
            <ShieldCheck size={18} strokeWidth={1.8} aria-hidden="true" />
            <Typography variant="subtitle2">{t('shell.administration')}</Typography>
          </Box>
          <Box sx={{ ml: { xs: 0, sm: 1.5 } }}>
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
            <FullscreenControl />
            <NotificationMenu />
          </Box>
          <Box
            sx={{
              ml: { xs: 0.25, md: 1 },
              pl: { xs: 0, md: 1 },
              borderLeft: { md: 1 },
              borderColor: 'divider',
            }}
          >
            <AccountMenu showIdentity />
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        data-testid="admin-main"
        sx={{
          pt: `${HEADER_HEIGHT}px`,
          width: { xs: 1, lg: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          ml: { xs: 0, lg: `${SIDEBAR_WIDTH}px` },
          minWidth: 0,
          minHeight: '100dvh',
          overflowX: 'clip',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
