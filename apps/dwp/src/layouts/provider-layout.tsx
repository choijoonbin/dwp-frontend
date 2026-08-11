import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  BadgeDollarSign,
  Braces,
  ClipboardList,
  Database,
  Gauge,
  HeartPulse,
  LifeBuoy,
  ListChecks,
  Settings2,
} from 'lucide-react';
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

import { BrandLockup } from '../components/brand-lockup';
import { ShellHeader } from '../components/shell-header';
import { useCurrentProviderSupportContext } from '../features/provider/use-provider-support-context';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';

export function ProviderLayout() {
  const { t } = useTranslation('provider');
  const shell = shellRegistry.provider;
  const sidebarWidth = shell.desktopNavigationWidth;
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const supportContext = useCurrentProviderSupportContext();
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
    staleTime: 30_000,
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
          path: '/provider/code-contracts',
          label: t('navigation.codeContracts'),
          icon: Braces,
          permission: 'CATALOG_READ',
        },
        {
          path: '/provider/data-governance',
          label: t('navigation.dataGovernance'),
          icon: Database,
          permission: 'DATA_GOVERNANCE_READ',
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
      <Box sx={{ minHeight: shellHeaderHeight, px: 2, display: 'flex', alignItems: 'center' }}>
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
        <ActionButton
          component={NavLink}
          to={supportContext.data ? '/admin' : '/account/settings/appearance'}
          fullWidth
          intent="quiet"
          startIcon={supportContext.data ? <LifeBuoy size={17} /> : <Settings2 size={17} />}
          onClick={onNavigate}
          sx={{ justifyContent: 'flex-start' }}
        >
          {t(supportContext.data ? 'shell.backToTenantSupport' : 'shell.accountSettings', {
            tenant: supportContext.data?.tenantName,
          })}
        </ActionButton>
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
          width: sidebarWidth,
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
        slotProps={{ paper: { sx: { width: sidebarWidth } } }}
      >
        <Box data-testid="provider-mobile-sidebar" sx={{ height: 1 }}>
          {navigation(() => setMobileOpen(false))}
        </Box>
      </Drawer>
      <ShellHeader
        testId="provider-header"
        shellKey={shell.key}
        scope={shell.scope}
        desktopOffset={sidebarWidth}
        context={{ icon: shell.context.icon, label: t(shell.context.labelKey) }}
        navigation={{
          label: t('shell.openNavigation'),
          onOpen: () => setMobileOpen(true),
        }}
      />
      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        sx={{
          pt: `${shellHeaderHeight}px`,
          width: { xs: 1, lg: `calc(100% - ${sidebarWidth}px)` },
          ml: { xs: 0, lg: `${sidebarWidth}px` },
          minWidth: 0,
          minHeight: '100dvh',
          overflowX: 'clip',
          outline: 'none',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
