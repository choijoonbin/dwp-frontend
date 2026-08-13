import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Home, LifeBuoy, X } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  revokeProviderSupportSession,
  type ProviderSupportSessionContext,
} from '@dwp-frontend/shared-utils/api/provider-control-api';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { BrandLockup } from '../components/brand-lockup';
import { ShellHeader } from '../components/shell-header';
import {
  ADMIN_NAVIGATION,
  type AdminNavigationGroup,
  type AdminSection,
} from '../features/admin/admin-navigation';
import {
  canAccessAdminNavigationItem,
  hasProviderControlPlaneRole,
} from '../features/auth/control-plane-access';
import {
  providerSupportContextQueryKey,
  useProviderSupportContext,
} from '../features/provider/use-provider-support-context';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';

type AdminNavigationProps = {
  onNavigate?: () => void;
  supportScopes?: readonly string[];
};

function initialExpandedGroups(): Record<AdminSection, boolean> {
  return ADMIN_NAVIGATION.reduce(
    (groups, group) => ({ ...groups, [group.id]: false }),
    {} as Record<AdminSection, boolean>
  );
}

function AdminNavigation({ onNavigate, supportScopes }: AdminNavigationProps) {
  const { t } = useTranslation('admin');
  const { hasPermission, isLoaded } = usePermissions();
  const auth = useAuth();
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

  const visibleGroups = ADMIN_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      canAccessAdminNavigationItem(item, {
        roles: auth.user?.roles ?? [],
        permissionsLoaded: isLoaded,
        hasPermission,
        supportScopes,
        resourceRoles: auth.user?.resourceRoles,
      })
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <Box component="nav" aria-label={t('shell.navigationLabel')} sx={{ py: 1.5 }}>
      <List disablePadding sx={{ display: 'grid', gap: 0.5, px: 1.25 }}>
        {visibleGroups.map((group) => {
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
                  {group.items.map((item) => {
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

function SupportAccessBanner({ context }: { context: ProviderSupportSessionContext }) {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [exiting, setExiting] = useState(false);

  const exit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await revokeProviderSupportSession(context, t('supportMode.exitReason'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: providerSupportContextQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['provider', 'support'] }),
      ]);
      toast.success(t('supportMode.exited'));
      navigate('/provider/support');
    } catch {
      toast.error(t('supportMode.exitFailed'));
      setExiting(false);
    }
  };

  return (
    <Box
      role="status"
      sx={{
        px: { xs: 2, md: 3 },
        py: 1,
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexWrap: 'wrap',
        gap: 1,
        bgcolor: 'warning.light',
        color: 'warning.contrastText',
        borderBottom: 1,
        borderColor: 'warning.main',
      }}
    >
      <LifeBuoy size={18} strokeWidth={1.9} aria-hidden="true" />
      <Box sx={{ minWidth: 180, flex: 1 }}>
        <Typography variant="subtitle2">
          {t('supportMode.title', { tenant: context.tenantName })}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.86 }}>
          {t('supportMode.expires', {
            value: formatDate(context.expiresAt, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          })}
        </Typography>
      </Box>
      <Chip
        size="small"
        variant="outlined"
        label={t(`supportMode.accessMode.${context.accessMode}`)}
        color={context.accessMode === 'BREAK_GLASS' ? 'error' : 'default'}
      />
      <Button
        size="small"
        color="inherit"
        startIcon={<X size={16} />}
        disabled={exiting}
        onClick={() => void exit()}
      >
        {t('supportMode.exit')}
      </Button>
    </Box>
  );
}

export function AdminLayout() {
  const { t } = useTranslation('admin');
  const shell = shellRegistry.admin;
  const sidebarWidth = shell.desktopNavigationWidth;
  const auth = useAuth();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  const [mobileOpen, setMobileOpen] = useState(false);
  const tenantName =
    supportContext.data?.tenantName ||
    auth.user?.tenantName ||
    auth.user?.tenantCode ||
    t('shell.tenantFallback');

  const navigationContent = (onNavigate?: () => void) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          minHeight: shellHeaderHeight,
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
        <AdminNavigation onNavigate={onNavigate} supportScopes={supportContext.data?.scopes} />
      </Box>

      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button
          component={NavLink}
          to={supportContext.data ? '/provider/support' : '/'}
          fullWidth
          color="inherit"
          startIcon={
            supportContext.data ? (
              <LifeBuoy size={17} strokeWidth={1.8} />
            ) : (
              <Home size={17} strokeWidth={1.8} />
            )
          }
          onClick={onNavigate}
          sx={{ justifyContent: 'flex-start' }}
        >
          {t(supportContext.data ? 'supportMode.backToProvider' : 'shell.backToWorkspace')}
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
          width: sidebarWidth,
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
        slotProps={{ paper: { sx: { width: sidebarWidth } } }}
      >
        <Box data-testid="admin-mobile-sidebar" sx={{ height: 1 }}>
          {navigationContent(() => setMobileOpen(false))}
        </Box>
      </Drawer>

      <ShellHeader
        testId="admin-header"
        shellKey={shell.key}
        scope={supportContext.data ? 'support' : 'tenant'}
        desktopOffset={sidebarWidth}
        context={{ icon: shell.context.icon, label: t(shell.context.labelKey) }}
        navigation={{
          label: t('shell.openNavigation'),
          onOpen: () => setMobileOpen(true),
        }}
        showWorkspace={shell.showWorkspace && !supportContext.data}
      />

      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        data-testid="admin-main"
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
        {supportContext.data && <SupportAccessBanner context={supportContext.data} />}
        <Outlet />
      </Box>
    </Box>
  );
}
