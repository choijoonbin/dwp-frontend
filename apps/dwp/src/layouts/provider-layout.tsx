import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, Settings2 } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { getProviderOperatorProfile } from '@dwp-frontend/shared-utils/api/provider-control-api';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Tooltip from '@mui/material/Tooltip';

import { BrandLockup } from '../components/brand-lockup';
import { ShellHeader } from '../components/shell-header';
import { useCurrentProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { PROVIDER_NAVIGATION } from '../features/provider/provider-navigation';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';
import {
  DesktopNavigationToggle,
  useDesktopNavigation,
} from '../features/shell/desktop-navigation';

export function ProviderLayout() {
  const { t } = useTranslation('provider');
  const shell = shellRegistry.provider;
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    compact,
    collapsible,
    desktopOffset,
    sidebarWidth,
    toggle: toggleDesktopNavigation,
  } = useDesktopNavigation(shell);
  const supportContext = useCurrentProviderSupportContext();
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
    staleTime: 30_000,
  });
  const permissions = operator.data?.permissions ?? [];
  const navigationGroups = PROVIDER_NAVIGATION.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => permissions.includes(item.permission))
      .map((item) => ({ ...item, label: t(`navigation.${item.key}`) })),
  }));
  const navigation = (compactNavigation: boolean, onNavigate?: () => void) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          minHeight: shellHeaderHeight,
          px: compactNavigation ? 0 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: compactNavigation ? 'center' : 'flex-start',
        }}
      >
        <BrandLockup
          variant={compactNavigation ? 'product-only' : 'product-full'}
          label={t('shell.title')}
          description={t('shell.productName')}
        />
      </Box>
      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 0.75, display: compactNavigation ? 'none' : 'block' }}>
        <Typography variant="overline" color="text.secondary">
          {t('shell.operatorWorkspace')}
        </Typography>
        <Typography variant="body2" fontWeight={700}>
          {operator.data?.displayName ?? t('shell.globalScope')}
        </Typography>
      </Box>
      {operator.isError && !operator.data && (
        <Box role="alert" sx={{ mx: 1.5, mb: 0.75, p: 1.25, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {t('errors.operatorProfile')}
          </Typography>
          <ActionButton
            intent="quiet"
            size="small"
            disabled={operator.isFetching}
            onClick={() => void operator.refetch()}
            sx={{ mt: 0.5, px: 0 }}
          >
            {t('actions.retryLoad')}
          </ActionButton>
        </Box>
      )}
      <List
        component="nav"
        aria-label={t('shell.navigationLabel')}
        disablePadding
        sx={{ flex: 1, px: compactNavigation ? 1 : 1.25, py: 1 }}
      >
        {navigationGroups.map((group) =>
          group.items.length ? (
            <Fragment key={group.key}>
              {!compactNavigation && (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: 'block', px: 1.25, pt: 1.25, pb: 0.5 }}
                >
                  {t(`navigation.groups.${group.key}`)}
                </Typography>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const selected =
                  pathname === item.path ||
                  (item.path === '/provider/tenants' && pathname.startsWith('/provider/tenants/'));
                return (
                  <Tooltip
                    key={item.path}
                    title={compactNavigation ? item.label : ''}
                    placement="right"
                  >
                    <ListItemButton
                      component={NavLink}
                      to={item.path}
                      selected={selected}
                      aria-label={compactNavigation ? item.label : undefined}
                      onClick={onNavigate}
                      sx={{
                        minHeight: 42,
                        justifyContent: compactNavigation ? 'center' : 'flex-start',
                        px: compactNavigation ? 1 : 1.25,
                        borderRadius: 1,
                        color: selected ? 'primary.main' : 'text.secondary',
                        '&.Mui-selected': { bgcolor: 'action.selected' },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: compactNavigation ? 0 : 34,
                          justifyContent: 'center',
                          color: 'inherit',
                        }}
                      >
                        <Icon size={18} />
                      </ListItemIcon>
                      {!compactNavigation && (
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            variant: 'subtitle2',
                            fontWeight: selected ? 750 : 600,
                          }}
                        />
                      )}
                    </ListItemButton>
                  </Tooltip>
                );
              })}
            </Fragment>
          ) : null
        )}
      </List>
      <Box sx={{ p: compactNavigation ? 1 : 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Tooltip
          title={
            compactNavigation
              ? t(supportContext.data ? 'shell.backToTenantSupport' : 'shell.accountSettings', {
                  tenant: supportContext.data?.tenantName,
                })
              : ''
          }
          placement="right"
        >
          <ActionButton
            component={NavLink}
            to={supportContext.data ? '/admin' : '/account/settings/appearance'}
            fullWidth
            intent="quiet"
            aria-label={
              compactNavigation
                ? t(supportContext.data ? 'shell.backToTenantSupport' : 'shell.accountSettings', {
                    tenant: supportContext.data?.tenantName,
                  })
                : undefined
            }
            startIcon={supportContext.data ? <LifeBuoy size={17} /> : <Settings2 size={17} />}
            onClick={onNavigate}
            sx={{
              justifyContent: compactNavigation ? 'center' : 'flex-start',
              minWidth: 0,
              px: compactNavigation ? 1 : undefined,
              '& .MuiButton-startIcon': { m: compactNavigation ? 0 : undefined },
            }}
          >
            {!compactNavigation &&
              t(supportContext.data ? 'shell.backToTenantSupport' : 'shell.accountSettings', {
                tenant: supportContext.data?.tenantName,
              })}
          </ActionButton>
        </Tooltip>
      </Box>
    </Box>
  );
  return (
    <Box
      data-testid="provider-shell"
      data-dwp-navigation-state={compact ? 'compact' : 'expanded'}
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      <Box
        component="aside"
        id="provider-desktop-navigation"
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
        {navigation(compact)}
      </Box>
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { sx: { width: shell.desktopNavigationWidth } } }}
      >
        <Box data-testid="provider-mobile-sidebar" sx={{ height: 1 }}>
          {navigation(false, () => setMobileOpen(false))}
        </Box>
      </Drawer>
      <ShellHeader
        testId="provider-header"
        shellKey={shell.key}
        scope={shell.scope}
        desktopOffset={desktopOffset}
        context={{ icon: shell.context.icon, label: t(shell.context.labelKey) }}
        navigation={{
          label: t('shell.openNavigation'),
          onOpen: () => setMobileOpen(true),
        }}
        leading={
          collapsible ? (
            <DesktopNavigationToggle
              compact={compact}
              controlsId="provider-desktop-navigation"
              onToggle={toggleDesktopNavigation}
            />
          ) : undefined
        }
      />
      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        sx={{
          pt: `${shellHeaderHeight}px`,
          width: { xs: 1, lg: `calc(100% - ${desktopOffset}px)` },
          ml: { xs: 0, lg: `${desktopOffset}px` },
          minWidth: 0,
          minHeight: '100dvh',
          overflowX: 'clip',
          outline: 'none',
          transition: (theme) => theme.transitions.create(['width', 'margin-left']),
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
