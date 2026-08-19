import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Newspaper } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { getCommunicationFeed } from '@dwp-frontend/shared-utils/api/communication-api';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { BrandLockup } from '../components/brand-lockup';
import { ShellHeader } from '../components/shell-header';
import { COMMUNICATIONS_NAVIGATION } from '../features/communications/communications-navigation';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';
import {
  DesktopNavigationToggle,
  useDesktopNavigation,
} from '../features/shell/desktop-navigation';

export function CommunicationsLayout() {
  const { t } = useTranslation('communications');
  const auth = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const shell = shellRegistry.communications;
  const {
    compact,
    collapsible,
    desktopOffset,
    sidebarWidth,
    toggle: toggleDesktopNavigation,
  } = useDesktopNavigation(shell);
  const tenantName = auth.user?.tenantName || auth.user?.tenantCode || t('shell.tenantFallback');
  const summary = useQuery({
    queryKey: ['communications', 'feed', 'for-you', '', 'ALL', 24],
    queryFn: () => getCommunicationFeed({ scope: 'for-you', type: 'ALL', size: 24 }),
    staleTime: 30_000,
    retry: 1,
  });

  const countFor = (item: 'required' | 'saved') => summary.data?.summary[item] ?? 0;
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
        <BrandLockup variant={compactNavigation ? 'product-only' : 'product-full'} />
      </Box>
      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 1.25, display: compactNavigation ? 'none' : 'block' }}>
        <Typography component="p" variant="overline" color="text.secondary">
          {t('shell.communications.context')}
        </Typography>
        <Typography variant="body2" fontWeight={750} noWrap>
          {tenantName}
        </Typography>
      </Box>
      <Box component="nav" aria-label={t('shell.communications.navigationLabel')} sx={{ flex: 1 }}>
        {COMMUNICATIONS_NAVIGATION.map((group) => (
          <Box key={group.id} sx={{ pb: 1.5 }}>
            {!compactNavigation && (
              <Typography
                component="p"
                variant="overline"
                color="text.secondary"
                sx={{ px: 2.5, py: 0.75 }}
              >
                {t(`navigation.groups.${group.id}`)}
              </Typography>
            )}
            <List
              disablePadding
              sx={{ display: 'grid', gap: 0.35, px: compactNavigation ? 1 : 1.25 }}
            >
              {group.items.map((item) => {
                const selected = pathname === item.path || pathname.startsWith(`${item.path}/`);
                const Icon = item.icon;
                const count = item.id === 'required' || item.id === 'saved' ? countFor(item.id) : 0;
                const label = t(`navigation.items.${item.id}`);
                return (
                  <Box component="li" key={item.id} sx={{ listStyle: 'none' }}>
                    <Tooltip title={compactNavigation ? label : ''} placement="right">
                      <ListItemButton
                        component={NavLink}
                        to={item.path}
                        selected={selected}
                        aria-label={compactNavigation ? label : undefined}
                        aria-current={selected ? 'page' : undefined}
                        onClick={onNavigate}
                        sx={{
                          minHeight: 42,
                          justifyContent: compactNavigation ? 'center' : 'flex-start',
                          px: compactNavigation ? 1 : 1.25,
                          borderRadius: 1,
                          position: 'relative',
                          color: selected ? 'primary.main' : 'text.secondary',
                          '&.Mui-selected': { bgcolor: 'action.selected' },
                          '&.Mui-selected:hover': { bgcolor: 'action.selected' },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: compactNavigation ? 0 : 34,
                            justifyContent: 'center',
                            color: 'inherit',
                          }}
                        >
                          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                        </ListItemIcon>
                        {!compactNavigation && (
                          <ListItemText
                            primary={label}
                            primaryTypographyProps={{
                              variant: 'body2',
                              fontWeight: selected ? 750 : 600,
                            }}
                          />
                        )}
                        {count > 0 && (
                          <Chip
                            size="small"
                            label={count > 99 ? '99+' : count}
                            color={item.id === 'required' ? 'error' : 'default'}
                            sx={{
                              minWidth: compactNavigation ? 18 : 28,
                              height: compactNavigation ? 18 : 20,
                              position: compactNavigation ? 'absolute' : 'static',
                              top: compactNavigation ? 2 : undefined,
                              right: compactNavigation ? 2 : undefined,
                              '& .MuiChip-label': { px: compactNavigation ? 0.45 : 0.75 },
                            }}
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
      <Box sx={{ p: compactNavigation ? 1 : 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Tooltip title={compactNavigation ? t('shell.backToHome') : ''} placement="right">
          <ActionButton
            component={NavLink}
            to="/"
            fullWidth
            intent="quiet"
            aria-label={compactNavigation ? t('shell.backToHome') : undefined}
            startIcon={<Home size={17} strokeWidth={1.8} />}
            onClick={onNavigate}
            sx={{
              justifyContent: compactNavigation ? 'center' : 'flex-start',
              minWidth: 0,
              px: compactNavigation ? 1 : undefined,
              '& .MuiButton-startIcon': { m: compactNavigation ? 0 : undefined },
            }}
          >
            {!compactNavigation && t('shell.backToHome')}
          </ActionButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box
      data-testid="communications-shell"
      data-dwp-navigation-state={compact ? 'compact' : 'expanded'}
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      <Box
        component="aside"
        id="communications-desktop-navigation"
        data-testid="communications-sidebar"
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
            'aria-label': t('shell.communications.navigationLabel'),
            sx: { width: shell.desktopNavigationWidth },
          },
        }}
      >
        <Box sx={{ height: 1 }}>{navigationContent(false, () => setMobileOpen(false))}</Box>
      </Drawer>
      <ShellHeader
        testId="communications-header"
        shellKey={shell.key}
        scope={shell.scope}
        desktopOffset={desktopOffset}
        context={{ icon: Newspaper, label: t('shell.communications.name') }}
        navigation={{
          label: t('shell.openNavigation'),
          onOpen: () => setMobileOpen(true),
        }}
        leading={
          collapsible ? (
            <DesktopNavigationToggle
              compact={compact}
              controlsId="communications-desktop-navigation"
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
