import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Newspaper } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { getCommunicationFeed, useAuth } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import { BrandLockup } from '../components/brand-lockup';
import { ShellHeader } from '../components/shell-header';
import { COMMUNICATIONS_NAVIGATION } from '../features/communications/communications-navigation';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';

export function CommunicationsLayout() {
  const { t } = useTranslation('communications');
  const auth = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const shell = shellRegistry.communications;
  const sidebarWidth = shell.desktopNavigationWidth;
  const tenantName = auth.user?.tenantName || auth.user?.tenantCode || t('shell.tenantFallback');
  const summary = useQuery({
    queryKey: ['communications', 'feed', 'for-you', '', 'ALL', 24],
    queryFn: () => getCommunicationFeed({ scope: 'for-you', type: 'ALL', size: 24 }),
    staleTime: 30_000,
    retry: 1,
  });

  const countFor = (item: 'required' | 'saved') => summary.data?.summary[item] ?? 0;
  const navigationContent = (onNavigate?: () => void) => (
    <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ minHeight: shellHeaderHeight, px: 2, display: 'flex', alignItems: 'center' }}>
        <BrandLockup variant="product-full" />
      </Box>
      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 1.25 }}>
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
            <Typography
              component="p"
              variant="overline"
              color="text.secondary"
              sx={{ px: 2.5, py: 0.75 }}
            >
              {t(`navigation.groups.${group.id}`)}
            </Typography>
            <List disablePadding sx={{ display: 'grid', gap: 0.35, px: 1.25 }}>
              {group.items.map((item) => {
                const selected = pathname === item.path || pathname.startsWith(`${item.path}/`);
                const Icon = item.icon;
                const count = item.id === 'required' || item.id === 'saved' ? countFor(item.id) : 0;
                return (
                  <Box component="li" key={item.id} sx={{ listStyle: 'none' }}>
                    <ListItemButton
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
                        primary={t(`navigation.items.${item.id}`)}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: selected ? 750 : 600,
                        }}
                      />
                      {count > 0 && (
                        <Chip
                          size="small"
                          label={count > 99 ? '99+' : count}
                          color={item.id === 'required' ? 'error' : 'default'}
                          sx={{ minWidth: 28, height: 20, '& .MuiChip-label': { px: 0.75 } }}
                        />
                      )}
                    </ListItemButton>
                  </Box>
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
      data-testid="communications-shell"
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      <Box
        component="aside"
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
        }}
      >
        {navigationContent()}
      </Box>
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{
          paper: {
            'aria-label': t('shell.communications.navigationLabel'),
            sx: { width: sidebarWidth },
          },
        }}
      >
        <Box sx={{ height: 1 }}>{navigationContent(() => setMobileOpen(false))}</Box>
      </Drawer>
      <ShellHeader
        testId="communications-header"
        shellKey={shell.key}
        scope={shell.scope}
        desktopOffset={sidebarWidth}
        context={{ icon: Newspaper, label: t('shell.communications.name') }}
        navigation={{
          label: t('shell.openNavigation'),
          onOpen: () => setMobileOpen(true),
        }}
        showWorkspace={shell.showWorkspace}
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
