import { Home, Menu, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import { useAuth } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
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
import { accountNavigationGroups } from '../features/account/settings-navigation';

import { useState } from 'react';

const SIDEBAR_WIDTH = foundationTokens.layout.adminNavigationExpanded;
const HEADER_HEIGHT = foundationTokens.layout.headerHeight;

type AccountNavigationProps = {
  onNavigate?: () => void;
};

function AccountNavigation({ onNavigate }: AccountNavigationProps) {
  const { t } = useTranslation('account');
  const { pathname } = useLocation();

  return (
    <Box component="nav" aria-label={t('shell.navigationLabel')} sx={{ py: 1.25 }}>
      {accountNavigationGroups.map((group, groupIndex) => (
        <Box key={group.key} sx={{ mt: groupIndex === 0 ? 0 : 2 }}>
          <Typography
            component="p"
            variant="overline"
            color="text.secondary"
            sx={{ display: 'block', px: 2.5, pb: 0.5 }}
          >
            {t(`shell.groups.${group.key}`)}
          </Typography>
          <List disablePadding sx={{ display: 'grid', gap: 0.25, px: 1.25 }}>
            {group.items.map((item) => {
              const Icon = item.icon;
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
                      position: 'relative',
                      minHeight: 42,
                      px: 1.25,
                      borderRadius: 1,
                      color: selected ? 'primary.main' : 'text.secondary',
                      '& .MuiListItemText-primary': { fontWeight: selected ? 750 : 600 },
                      '&.Mui-selected': { bgcolor: 'action.selected' },
                      '&.Mui-selected::before': {
                        position: 'absolute',
                        left: 0,
                        width: 3,
                        height: 22,
                        borderRadius: 1,
                        bgcolor: 'primary.main',
                        content: '""',
                      },
                      '&.Mui-selected:hover': { bgcolor: 'action.selected' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText
                      primary={t(`navigation.${item.key}`)}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                </Box>
              );
            })}
          </List>
        </Box>
      ))}
    </Box>
  );
}

export function AccountLayout() {
  const { t } = useTranslation('account');
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountName = auth.user?.displayName || t('shell.accountFallback');
  const accountContext =
    auth.user?.email ||
    auth.user?.tenantName ||
    auth.user?.tenantCode ||
    t('shell.personalSettings');

  const navigationContent = (onNavigate?: () => void) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          minHeight: HEADER_HEIGHT,
          px: 2,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <BrandLockup
          variant="product-full"
          label={t('shell.title')}
          description={t('brand.productName', { ns: 'shell' })}
          sx={{ flexShrink: 0 }}
        />
      </Box>

      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 0.75, minWidth: 0 }}>
        <Typography component="p" variant="overline" color="text.secondary">
          {t('shell.personalSettings')}
        </Typography>
        <Typography variant="body2" fontWeight={750} noWrap>
          {accountName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
          {accountContext}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <AccountNavigation onNavigate={onNavigate} />
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
    <Box data-testid="account-shell" sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box
        component="aside"
        data-testid="account-sidebar"
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
        slotProps={{
          paper: {
            'aria-label': t('shell.navigationLabel'),
            sx: { width: SIDEBAR_WIDTH },
          },
        }}
      >
        <Box data-testid="account-mobile-sidebar" sx={{ height: 1 }}>
          {navigationContent(() => setMobileOpen(false))}
        </Box>
      </Drawer>

      <AppBar
        data-testid="account-header"
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
            <Settings2 size={18} strokeWidth={1.8} aria-hidden="true" />
            <Typography component="span" variant="subtitle2">
              {t('shell.title')}
            </Typography>
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
        data-testid="account-main"
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
