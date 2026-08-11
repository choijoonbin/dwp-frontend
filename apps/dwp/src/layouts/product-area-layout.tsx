import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Menu } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import { AccountMenu } from '../components/account-menu';
import { BrandLockup } from '../components/brand-lockup';
import {
  FullscreenControl,
  NotificationMenu,
  SearchControl,
  WorkspaceMenu,
} from '../components/shell-controls';

import type { LucideIcon } from 'lucide-react';

const SIDEBAR_WIDTH = foundationTokens.layout.adminNavigationExpanded;
const HEADER_HEIGHT = foundationTokens.layout.headerHeight;

export type ProductAreaNavigationItem = {
  path: string;
  view: string;
  icon: LucideIcon;
};

export type ProductAreaNavigationGroup = {
  id: string;
  items: readonly ProductAreaNavigationItem[];
};

type ProductAreaLayoutProps = {
  areaKey: 'people' | 'workforce';
  areaIcon: LucideIcon;
  navigation: readonly ProductAreaNavigationGroup[];
};

export function ProductAreaLayout({
  areaKey,
  areaIcon: AreaIcon,
  navigation,
}: ProductAreaLayoutProps) {
  const { t } = useTranslation('workforce');
  const auth = useAuth();
  const { pathname } = useLocation();
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
        }}
      >
        <BrandLockup
          variant="product-full"
          label={t(`shell.${areaKey}.name`)}
          description={t(`shell.${areaKey}.description`)}
        />
      </Box>
      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 1 }}>
        <Typography component="p" variant="overline" color="text.secondary">
          {t(`shell.${areaKey}.context`)}
        </Typography>
        <Typography variant="body2" fontWeight={750} noWrap>
          {tenantName}
        </Typography>
      </Box>
      <Box component="nav" aria-label={t(`shell.${areaKey}.navigationLabel`)} sx={{ flex: 1 }}>
        {navigation.map((group) => (
          <Box key={group.id} sx={{ pb: 1.25 }}>
            <Typography
              component="p"
              variant="overline"
              color="text.secondary"
              sx={{ px: 2.5, py: 0.75 }}
            >
              {t(`navigation.groups.${areaKey}.${group.id}`)}
            </Typography>
            <List disablePadding sx={{ display: 'grid', gap: 0.35, px: 1.25 }}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const selected = pathname === item.path;
                return (
                  <ListItemButton
                    key={item.path}
                    component={NavLink}
                    to={item.path}
                    selected={selected}
                    aria-current={selected ? 'page' : undefined}
                    onClick={onNavigate}
                    sx={{
                      minHeight: 42,
                      px: 1.25,
                      borderRadius: 1,
                      color: selected ? 'primary.main' : 'text.secondary',
                      '&.Mui-selected': { bgcolor: 'action.selected' },
                      '&.Mui-selected:hover': { bgcolor: 'action.selected' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText
                      primary={t(`navigation.items.${areaKey}.${item.view}.label`)}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: selected ? 750 : 600,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <ActionButton
          component={NavLink}
          to="/"
          fullWidth
          intent="quiet"
          startIcon={<Home size={17} strokeWidth={1.8} />}
          onClick={onNavigate}
          sx={{ justifyContent: 'flex-start' }}
        >
          {t('shell.backToHome')}
        </ActionButton>
      </Box>
    </Box>
  );

  return (
    <Box
      data-testid={`${areaKey}-shell`}
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      <Box
        component="aside"
        data-testid={`${areaKey}-sidebar`}
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
        {navigationContent(() => setMobileOpen(false))}
      </Drawer>
      <AppBar
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
          <ActionIconButton
            label={t('shell.openNavigation')}
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 0.5, display: { lg: 'none' } }}
          >
            <Menu size={21} strokeWidth={1.8} />
          </ActionIconButton>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
            <AreaIcon size={18} strokeWidth={1.8} aria-hidden="true" />
            <Typography variant="subtitle2">{t(`shell.${areaKey}.name`)}</Typography>
          </Box>
          <Box sx={{ ml: { xs: 0, sm: 1.5 } }}>
            <WorkspaceMenu />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <SearchControl />
          <Box sx={{ ml: { xs: 0, md: 1.5 }, display: 'flex', alignItems: 'center' }}>
            <FullscreenControl />
            <NotificationMenu />
          </Box>
          <Box sx={{ ml: 1, pl: 1, borderLeft: 1, borderColor: 'divider' }}>
            <AccountMenu showIdentity />
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
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
