import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppWindow } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  listRuntimeNavigation,
  type RuntimeNavigationNode,
} from '@dwp-frontend/shared-utils/api/navigation-runtime-api';
import type { PermissionDTO } from '@dwp-frontend/shared-utils/api/auth-api';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { BrandLockup } from '../components/brand-lockup';
import { ShellHeader } from '../components/shell-header';
import {
  shellHeaderHeight,
  shellRegistry,
  workspaceCoreContexts,
  workspaceNavigationIcons,
} from '../features/shell/shell-registry';
import {
  DesktopNavigationToggle,
  useDesktopNavigation,
} from '../features/shell/desktop-navigation';

function hasRuntimePermission(node: RuntimeNavigationNode, permissions: PermissionDTO[]): boolean {
  if (!node.requiredResourceKey) return true;
  const requiredPermission = node.requiredPermissionCode || 'VIEW';
  const matches = permissions.filter(
    (permission) =>
      permission.resourceKey === node.requiredResourceKey &&
      permission.permissionCode === requiredPermission
  );
  if (matches.some((permission) => permission.effect === 'DENY')) return false;
  return matches.some((permission) => permission.effect === 'ALLOW');
}

function filterRuntimeNavigation(
  nodes: RuntimeNavigationNode[],
  permissions: PermissionDTO[],
  permissionsLoaded: boolean
): RuntimeNavigationNode[] {
  return nodes.flatMap((node) => {
    if (node.itemType === 'GROUP') {
      const children = filterRuntimeNavigation(node.children, permissions, permissionsLoaded);
      return children.length ? [{ ...node, children }] : [];
    }
    if (!node.route || (!permissionsLoaded ? false : !hasRuntimePermission(node, permissions))) {
      return [];
    }
    return [{ ...node, children: [] }];
  });
}

function flattenRuntimeApps(nodes: RuntimeNavigationNode[]): RuntimeNavigationNode[] {
  return nodes.flatMap((node) =>
    node.itemType === 'GROUP' ? flattenRuntimeApps(node.children) : [node]
  );
}

type AppNavigationProps = {
  groups: RuntimeNavigationNode[];
  compact?: boolean;
  horizontal?: boolean;
  onNavigate?: () => void;
};

function useAppNavigationModel() {
  const { t, i18n } = useTranslation('shell');
  const { permissions, isLoaded: permissionsLoaded } = usePermissions();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const navigation = useQuery({
    queryKey: ['runtime-navigation', locale],
    queryFn: () => listRuntimeNavigation(locale),
    staleTime: 60_000,
    retry: 1,
  });
  const fallbackNavigation: RuntimeNavigationNode[] = [
    {
      navigationKey: 'workspace',
      itemType: 'GROUP',
      label: t('navigation.section'),
      requiredPermissionCode: 'VIEW',
      children: [
        {
          navigationKey: 'work',
          itemType: 'APP',
          label: t('navigation.items.work'),
          route: '/work',
          iconKey: 'work',
          requiredResourceKey: 'APP.WORK',
          requiredPermissionCode: 'VIEW',
          children: [],
        },
        {
          navigationKey: 'ask',
          itemType: 'APP',
          label: t('navigation.items.ask'),
          route: '/dwaion',
          iconKey: 'ask',
          requiredResourceKey: 'APP.ASK',
          requiredPermissionCode: 'VIEW',
          children: [],
        },
        {
          navigationKey: 'activity',
          itemType: 'APP',
          label: t('navigation.items.activity'),
          route: '/activity',
          iconKey: 'activity',
          requiredResourceKey: 'APP.ACTIVITY',
          requiredPermissionCode: 'VIEW',
          children: [],
        },
        {
          navigationKey: 'hcm',
          itemType: 'APP',
          label: t('navigation.items.hcm'),
          route: '/hr',
          iconKey: 'hcm',
          requiredResourceKey: 'APP.HCM',
          requiredPermissionCode: 'VIEW',
          children: [],
        },
        {
          navigationKey: 'apps',
          itemType: 'APP',
          label: t('navigation.items.apps'),
          route: '/apps',
          iconKey: 'apps',
          requiredResourceKey: 'APP.APPS',
          requiredPermissionCode: 'VIEW',
          children: [],
        },
      ],
    },
  ];
  const source = navigation.data ?? fallbackNavigation;
  return filterRuntimeNavigation(source, permissions, permissionsLoaded);
}

function AppNavigation({
  groups,
  compact = false,
  horizontal = false,
  onNavigate,
}: AppNavigationProps) {
  const { t } = useTranslation('shell');
  const { pathname } = useLocation();
  const horizontalItems = flattenRuntimeApps(groups);

  const renderItem = (item: RuntimeNavigationNode) => {
    if (!item.route) return null;
    const selected = pathname.startsWith(item.route);
    const Icon = workspaceNavigationIcons[item.iconKey || ''] || AppWindow;
    return (
      <Tooltip
        key={item.navigationKey}
        title={compact ? item.label : ''}
        placement="right"
        disableInteractive={!compact}
      >
        <ListItem disablePadding sx={{ width: horizontal ? 'auto' : 1 }}>
          <ListItemButton
            component={NavLink}
            to={item.route}
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
              '& .MuiListItemText-primary': { fontWeight: selected ? 700 : 600 },
              '&.Mui-selected': { bgcolor: 'action.selected', color: 'primary.main' },
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
  };

  return (
    <Box component="nav" aria-label={t('navigation.label')} sx={{ minWidth: 0 }}>
      {horizontal ? (
        <List disablePadding sx={{ display: 'flex', gap: 0.5 }}>
          {horizontalItems.map(renderItem)}
        </List>
      ) : (
        groups.map((group) => (
          <Box key={group.navigationKey}>
            {!compact && group.itemType === 'GROUP' && (
              <Typography
                component="p"
                variant="overline"
                color="text.secondary"
                sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}
              >
                {group.label}
              </Typography>
            )}
            <List disablePadding sx={{ display: 'grid', gap: 0.5, px: 1 }}>
              {(group.itemType === 'GROUP' ? group.children : [group]).map(renderItem)}
            </List>
          </Box>
        ))
      )}
    </Box>
  );
}

export function AppLayout() {
  const { t } = useTranslation('shell');
  const { pathname } = useLocation();
  const shell = shellRegistry.workspace;
  const navigationGroups = useAppNavigationModel();
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    compact: compactSidebar,
    collapsible: desktopNavigationCollapsible,
    desktopOffset,
    sidebarWidth,
    toggle: toggleDesktopNavigation,
    topNavigation,
  } = useDesktopNavigation(shell, { allowTopNavigation: true });
  const runtimeContext = flattenRuntimeApps(navigationGroups).find(
    (item) => item.route && (pathname === item.route || pathname.startsWith(`${item.route}/`))
  );
  const coreContext = workspaceCoreContexts.find(
    (item) => pathname === item.route || pathname.startsWith(`${item.route}/`)
  );
  const applicationContext = {
    icon: workspaceNavigationIcons[runtimeContext?.iconKey || ''] || coreContext?.icon || AppWindow,
    label:
      runtimeContext?.label || (coreContext ? t(coreContext.labelKey) : t('navigation.items.apps')),
  };

  const navigationContent = (compact: boolean, onNavigate?: () => void) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          height: shellHeaderHeight,
          px: compact ? 0 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'flex-start',
        }}
      >
        <BrandLockup variant={compact ? 'product-only' : 'product-full'} sx={{ flexShrink: 0 }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <AppNavigation groups={navigationGroups} compact={compact} onNavigate={onNavigate} />
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
              {t('workspace.connected')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t('workspace.healthSummary', { count: 4 })}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box
      data-dwp-navigation-state={topNavigation ? 'top' : compactSidebar ? 'compact' : 'expanded'}
      sx={{
        '--dwp-shell-navigation-offset': `${desktopOffset}px`,
        minHeight: '100dvh',
        bgcolor: 'background.default',
      }}
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
        slotProps={{ paper: { sx: { width: shell.desktopNavigationWidth } } }}
      >
        <Box data-testid="mobile-sidebar" sx={{ height: 1 }}>
          {navigationContent(false, () => setMobileOpen(false))}
        </Box>
      </Drawer>

      <ShellHeader
        testId="app-header"
        shellKey={shell.key}
        scope={shell.scope}
        desktopOffset={desktopOffset}
        context={applicationContext}
        navigation={{ label: t('navigation.open'), onOpen: () => setMobileOpen(true) }}
        leading={
          !topNavigation && desktopNavigationCollapsible ? (
            <DesktopNavigationToggle
              compact={compactSidebar}
              controlsId="desktop-navigation"
              onToggle={toggleDesktopNavigation}
            />
          ) : undefined
        }
        brand={
          topNavigation ? (
            <BrandLockup
              variant="product-full"
              sx={{ mr: 1, display: { xs: 'none', lg: 'inline-flex' } }}
            />
          ) : undefined
        }
        showWorkspace={shell.showWorkspace}
        primaryNavigation={
          topNavigation ? <AppNavigation groups={navigationGroups} horizontal /> : undefined
        }
      />

      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        data-testid="app-main"
        sx={{
          pt: `${shellHeaderHeight}px`,
          width: { xs: 1, lg: `calc(100% - ${desktopOffset}px)` },
          ml: { xs: 0, lg: `${desktopOffset}px` },
          minWidth: 0,
          minHeight: '100dvh',
          overflowX: 'clip',
          transition: (theme) => theme.transitions.create(['width', 'margin-left']),
          outline: 'none',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
