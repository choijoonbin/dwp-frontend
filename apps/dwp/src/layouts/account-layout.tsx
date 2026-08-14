import { CloudCog, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Tooltip from '@mui/material/Tooltip';

import { BrandLockup } from '../components/brand-lockup';
import { ShellHeader } from '../components/shell-header';
import { accountNavigationGroups } from '../features/account/settings-navigation';
import { hasProviderControlPlaneRole } from '../features/auth/control-plane-access';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';
import {
  DesktopNavigationToggle,
  useDesktopNavigation,
} from '../features/shell/desktop-navigation';

import { useState } from 'react';

type AccountNavigationProps = {
  compact?: boolean;
  onNavigate?: () => void;
};

function AccountNavigation({ compact = false, onNavigate }: AccountNavigationProps) {
  const { t } = useTranslation('account');
  const { pathname } = useLocation();

  return (
    <Box component="nav" aria-label={t('shell.navigationLabel')} sx={{ py: 1.25 }}>
      {accountNavigationGroups.map((group, groupIndex) => (
        <Box key={group.key} sx={{ mt: groupIndex === 0 ? 0 : 2 }}>
          {!compact && (
            <Typography
              component="p"
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', px: 2.5, pb: 0.5 }}
            >
              {t(`shell.groups.${group.key}`)}
            </Typography>
          )}
          <List disablePadding sx={{ display: 'grid', gap: 0.25, px: compact ? 1 : 1.25 }}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const selected = pathname === item.path;

              const label = t(`navigation.${item.key}`);
              return (
                <Box component="li" key={item.path} sx={{ display: 'block' }}>
                  <Tooltip title={compact ? label : ''} placement="right">
                    <ListItemButton
                      component={NavLink}
                      to={item.path}
                      selected={selected}
                      aria-label={compact ? label : undefined}
                      aria-current={selected ? 'page' : undefined}
                      onClick={onNavigate}
                      sx={{
                        position: 'relative',
                        minHeight: 42,
                        justifyContent: compact ? 'center' : 'flex-start',
                        px: compact ? 1 : 1.25,
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
                      <ListItemIcon
                        sx={{
                          minWidth: compact ? 0 : 34,
                          justifyContent: 'center',
                          color: 'inherit',
                        }}
                      >
                        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                      </ListItemIcon>
                      {!compact && (
                        <ListItemText
                          primary={label}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      )}
                    </ListItemButton>
                  </Tooltip>
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
  const shell = shellRegistry.account;
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    compact,
    collapsible,
    desktopOffset,
    sidebarWidth,
    toggle: toggleDesktopNavigation,
  } = useDesktopNavigation(shell);
  const accountName = auth.user?.displayName || t('shell.accountFallback');
  const providerAccount = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const returnDestination = providerAccount ? '/provider/overview' : '/';
  const accountContext =
    auth.user?.email ||
    auth.user?.tenantName ||
    auth.user?.tenantCode ||
    t('shell.personalSettings');

  const navigationContent = (compactNavigation: boolean, onNavigate?: () => void) => (
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
          description={t('brand.productName', { ns: 'shell' })}
          sx={{ flexShrink: 0 }}
        />
      </Box>

      <Divider />
      <Box
        sx={{
          px: 2.5,
          pt: 2.25,
          pb: 0.75,
          minWidth: 0,
          display: compactNavigation ? 'none' : 'block',
        }}
      >
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
        <AccountNavigation compact={compactNavigation} onNavigate={onNavigate} />
      </Box>

      <Box sx={{ p: compactNavigation ? 1 : 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Tooltip
          title={
            compactNavigation
              ? t(providerAccount ? 'shell.backToProvider' : 'shell.backToWorkspace')
              : ''
          }
          placement="right"
        >
          <Button
            component={NavLink}
            to={returnDestination}
            fullWidth
            color="inherit"
            aria-label={
              compactNavigation
                ? t(providerAccount ? 'shell.backToProvider' : 'shell.backToWorkspace')
                : undefined
            }
            startIcon={
              providerAccount ? (
                <CloudCog size={17} strokeWidth={1.8} />
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
              t(providerAccount ? 'shell.backToProvider' : 'shell.backToWorkspace')}
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box
      data-testid="account-shell"
      data-dwp-navigation-state={compact ? 'compact' : 'expanded'}
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      <Box
        component="aside"
        id="account-desktop-navigation"
        data-testid="account-sidebar"
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

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{
          paper: {
            'aria-label': t('shell.navigationLabel'),
            sx: { width: shell.desktopNavigationWidth },
          },
        }}
      >
        <Box data-testid="account-mobile-sidebar" sx={{ height: 1 }}>
          {navigationContent(false, () => setMobileOpen(false))}
        </Box>
      </Drawer>

      <ShellHeader
        testId="account-header"
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
              controlsId="account-desktop-navigation"
              onToggle={toggleDesktopNavigation}
            />
          ) : undefined
        }
        showWorkspace={shell.showWorkspace}
      />

      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        data-testid="account-main"
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
