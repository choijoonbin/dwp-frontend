import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  BadgeDollarSign,
  ClipboardList,
  Gauge,
  HeartPulse,
  Home,
  LifeBuoy,
  ListChecks,
  Menu,
  ShieldCheck,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import { getProviderOperatorProfile } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
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
import { FullscreenControl, NotificationMenu, SearchControl } from '../components/shell-controls';
import { useCurrentProviderSupportContext } from '../features/provider/use-provider-support-context';

const SIDEBAR_WIDTH = foundationTokens.layout.adminNavigationExpanded;
const HEADER_HEIGHT = foundationTokens.layout.headerHeight;

export function ProviderLayout() {
  const { t } = useTranslation('provider');
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const supportContext = useCurrentProviderSupportContext();
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const permissions = operator.data?.permissions ?? [];
  const navigationGroups = [
    {
      key: 'operate',
      items: [
        {
          path: '/provider/overview',
          label: t('navigation.overview'),
          icon: Gauge,
          permission: 'ESTATE_READ',
        },
        {
          path: '/provider/tenants',
          label: t('navigation.tenants'),
          icon: Building2,
          permission: 'ESTATE_READ',
        },
        {
          path: '/provider/operations',
          label: t('navigation.operations'),
          icon: ListChecks,
          permission: 'ESTATE_READ',
        },
        {
          path: '/provider/health',
          label: t('navigation.health'),
          icon: HeartPulse,
          permission: 'HEALTH_READ',
        },
      ],
    },
    {
      key: 'govern',
      items: [
        {
          path: '/provider/support',
          label: t('navigation.support'),
          icon: LifeBuoy,
          permission: 'ESTATE_READ',
        },
        {
          path: '/provider/commercial',
          label: t('navigation.commercial'),
          icon: BadgeDollarSign,
          permission: 'COMMERCIAL_READ',
        },
        {
          path: '/provider/audit',
          label: t('navigation.audit'),
          icon: ClipboardList,
          permission: 'AUDIT_READ',
        },
      ],
    },
  ].map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.includes(item.permission)),
  }));
  const navigation = (onNavigate?: () => void) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ minHeight: HEADER_HEIGHT, px: 2, display: 'flex', alignItems: 'center' }}>
        <BrandLockup
          variant="product-full"
          label={t('shell.title')}
          description={t('shell.productName')}
        />
      </Box>
      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 0.75 }}>
        <Typography variant="overline" color="text.secondary">
          {t('shell.operatorWorkspace')}
        </Typography>
        <Typography variant="body2" fontWeight={700}>
          {operator.data?.displayName ?? t('shell.globalScope')}
        </Typography>
      </Box>
      <List
        component="nav"
        aria-label={t('shell.navigationLabel')}
        disablePadding
        sx={{ flex: 1, px: 1.25, py: 1 }}
      >
        {navigationGroups.map((group) =>
          group.items.length ? (
            <Fragment key={group.key}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', px: 1.25, pt: 1.25, pb: 0.5 }}
              >
                {t(`navigation.groups.${group.key}`)}
              </Typography>
              {group.items.map((item) => {
                const Icon = item.icon;
                const selected =
                  pathname === item.path ||
                  (item.path === '/provider/tenants' && pathname.startsWith('/provider/tenants/'));
                return (
                  <ListItemButton
                    key={item.path}
                    component={NavLink}
                    to={item.path}
                    selected={selected}
                    onClick={onNavigate}
                    sx={{
                      minHeight: 42,
                      px: 1.25,
                      borderRadius: 1,
                      color: selected ? 'primary.main' : 'text.secondary',
                      '&.Mui-selected': { bgcolor: 'action.selected' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                      <Icon size={18} />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        variant: 'subtitle2',
                        fontWeight: selected ? 750 : 600,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </Fragment>
          ) : null
        )}
      </List>
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button
          component={NavLink}
          to={supportContext.data ? '/admin' : '/'}
          fullWidth
          color="inherit"
          startIcon={supportContext.data ? <LifeBuoy size={17} /> : <Home size={17} />}
          onClick={onNavigate}
          sx={{ justifyContent: 'flex-start' }}
        >
          {t(supportContext.data ? 'shell.backToTenantSupport' : 'shell.backToWorkspace', {
            tenant: supportContext.data?.tenantName,
          })}
        </Button>
      </Box>
    </Box>
  );
  return (
    <Box data-testid="provider-shell" sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box
        component="aside"
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
        {navigation()}
      </Box>
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH } } }}
      >
        {navigation(() => setMobileOpen(false))}
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
          <IconButton
            aria-label={t('shell.openNavigation')}
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 0.5, display: { lg: 'none' } }}
          >
            <Menu size={21} />
          </IconButton>
          <Stack direction="row" alignItems="center" gap={1}>
            <ShieldCheck size={18} />
            <Typography variant="subtitle2">{t('shell.title')}</Typography>
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <SearchControl />
          <Box
            sx={{
              ml: { xs: 0, md: 1.5 },
              pl: { xs: 0, md: 1 },
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
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
