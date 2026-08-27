import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Home, LifeBuoy } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Tooltip from '@mui/material/Tooltip';

import { DesktopNavigationHeader } from '../components/desktop-navigation-header';
import { ShellHeader } from '../components/shell-header';
import {
  ADMIN_NAVIGATION,
  type AdminNavigationGroup,
  type AdminSection,
} from '../features/admin/admin-navigation';
import { canAccessAdminNavigationItem } from '../features/admin/admin-access-policy';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';
import { useDesktopNavigation } from '../features/shell/desktop-navigation';
import {
  ShellMobileNavigationDrawer,
  useShellMobileNavigation,
} from '../features/shell/shell-mobile-navigation';

type AdminNavigationProps = {
  compact?: boolean;
  onNavigate?: () => void;
  supportScopes?: readonly string[];
};

function initialExpandedGroups(): Record<AdminSection, boolean> {
  return ADMIN_NAVIGATION.reduce(
    (groups, group) => ({ ...groups, [group.id]: false }),
    {} as Record<AdminSection, boolean>
  );
}

function AdminNavigation({ compact = false, onNavigate, supportScopes }: AdminNavigationProps) {
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

  if (compact) {
    return (
      <Box component="nav" aria-label={t('shell.navigationLabel')} sx={{ py: 1.5 }}>
        <List disablePadding sx={{ display: 'grid', gap: 0.35, px: 1 }}>
          {visibleGroups.flatMap((group) =>
            group.items.map((item) => {
              const ItemIcon = item.icon;
              const selected = pathname === item.path;
              const label = t(`navigation.items.${item.view}.label`);
              return (
                <Box component="li" key={item.path} sx={{ display: 'block' }}>
                  <Tooltip title={label} placement="right">
                    <ListItemButton
                      component={NavLink}
                      to={item.path}
                      selected={selected}
                      aria-label={label}
                      aria-current={selected ? 'page' : undefined}
                      onClick={onNavigate}
                      sx={{
                        minHeight: 42,
                        justifyContent: 'center',
                        px: 1,
                        borderRadius: 1,
                        color: selected ? 'primary.main' : 'text.secondary',
                        '&.Mui-selected': { bgcolor: 'action.selected' },
                        '&.Mui-selected:hover': { bgcolor: 'action.selected' },
                        '@media (forced-colors: active)': {
                          '&.Mui-selected': {
                            outline: '2px solid Highlight',
                            outlineOffset: '-2px',
                          },
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{ minWidth: 0, justifyContent: 'center', color: 'inherit' }}
                      >
                        <ItemIcon size={18} strokeWidth={1.8} aria-hidden="true" />
                      </ListItemIcon>
                    </ListItemButton>
                  </Tooltip>
                </Box>
              );
            })
          )}
        </List>
      </Box>
    );
  }

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
                            '@media (forced-colors: active)': {
                              '&.Mui-selected': {
                                outline: '2px solid Highlight',
                                outlineOffset: '-2px',
                              },
                            },
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
  const shell = shellRegistry.admin;
  const auth = useAuth();
  const providerRole = isProviderIdentity(auth.user);
  const supportContext = useProviderSupportContext(providerRole);
  const mobileNavigation = useShellMobileNavigation({ headerTestId: 'admin-header' });
  const mobileNavigationId = 'admin-mobile-navigation';
  const {
    compact,
    collapsible,
    desktopOffset,
    sidebarWidth,
    toggle: toggleDesktopNavigation,
  } = useDesktopNavigation(shell);
  const tenantName =
    supportContext.data?.tenantName ||
    (!providerRole && (auth.user?.tenantName || auth.user?.tenantCode)) ||
    t('shell.tenantFallback');

  const navigationContent = (
    compactNavigation: boolean,
    onNavigate?: () => void,
    onDismiss?: () => void
  ) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <DesktopNavigationHeader
        compact={compactNavigation}
        collapsible={collapsible}
        controlsId="admin-desktop-navigation"
        label={t('shell.controlCenter')}
        description={t('shell.productName')}
        onDismiss={onDismiss}
        onToggle={toggleDesktopNavigation}
      />

      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 0.75, display: compactNavigation ? 'none' : 'block' }}>
        <Typography component="p" variant="overline" color="text.secondary">
          {t('shell.tenantAdministration')}
        </Typography>
        <Typography variant="body2" fontWeight={700} noWrap>
          {tenantName}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <AdminNavigation
          compact={compactNavigation}
          onNavigate={onNavigate}
          supportScopes={supportContext.data?.scopes}
        />
      </Box>

      <Box sx={{ p: compactNavigation ? 1 : 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Tooltip
          title={
            compactNavigation
              ? t(supportContext.data ? 'supportMode.backToProvider' : 'shell.backToWorkspace')
              : ''
          }
          placement="right"
        >
          <Button
            component={NavLink}
            to={supportContext.data ? '/provider/support' : '/'}
            fullWidth
            color="inherit"
            aria-label={
              compactNavigation
                ? t(supportContext.data ? 'supportMode.backToProvider' : 'shell.backToWorkspace')
                : undefined
            }
            startIcon={
              supportContext.data ? (
                <LifeBuoy size={17} strokeWidth={1.8} />
              ) : (
                <Home size={17} strokeWidth={1.8} />
              )
            }
            onClick={onNavigate}
            sx={{
              justifyContent: compactNavigation ? 'center' : 'flex-start',
              minWidth: 0,
              px: compactNavigation ? 1 : undefined,
              '& .MuiButton-startIcon': { m: compactNavigation ? 0 : undefined },
            }}
          >
            {!compactNavigation &&
              t(supportContext.data ? 'supportMode.backToProvider' : 'shell.backToWorkspace')}
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box
      data-testid="admin-shell"
      data-dwp-navigation-state={compact ? 'compact' : 'expanded'}
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      <Box
        component="aside"
        id="admin-desktop-navigation"
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
          transition: (theme) => theme.transitions.create('width'),
        }}
      >
        {navigationContent(compact)}
      </Box>

      <ShellMobileNavigationDrawer
        controlsId={mobileNavigationId}
        label={t('shell.navigationLabel')}
        onDismiss={mobileNavigation.dismiss}
        open={mobileNavigation.open}
        testId="admin-mobile-sidebar"
        width={shell.desktopNavigationWidth}
      >
        {navigationContent(false, mobileNavigation.navigate, mobileNavigation.dismiss)}
      </ShellMobileNavigationDrawer>

      <ShellHeader
        testId="admin-header"
        shellKey={shell.key}
        scope={supportContext.data ? 'support' : 'tenant'}
        desktopOffset={desktopOffset}
        context={{ icon: shell.context.icon, label: t(shell.context.labelKey) }}
        navigation={{
          controlsId: mobileNavigationId,
          expanded: mobileNavigation.open,
          label: t('shell.openNavigation'),
          testId: 'admin-mobile-navigation-trigger',
          onOpen: mobileNavigation.openFrom,
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
