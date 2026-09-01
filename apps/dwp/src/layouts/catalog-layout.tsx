import { AppWindow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';

import { BrandLockup } from '../components/brand-lockup';
import { DesktopNavigationHeader } from '../components/desktop-navigation-header';
import { ShellHeader } from '../components/shell-header';
import {
  ShellMobileNavigationDrawer,
  useShellMobileNavigation,
} from '../features/shell/shell-mobile-navigation';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';

export function CatalogLayout() {
  const { t } = useTranslation('shell');
  const shell = shellRegistry.catalog;
  const mobileNavigation = useShellMobileNavigation({ headerTestId: 'catalog-header' });
  const mobileNavigationId = 'catalog-mobile-navigation';

  return (
    <Box data-testid="catalog-shell" sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <ShellMobileNavigationDrawer
        controlsId={mobileNavigationId}
        label={t('navigation.label')}
        onDismiss={mobileNavigation.dismiss}
        open={mobileNavigation.open}
        testId="catalog-mobile-sidebar"
        width={foundationTokens.layout.navigationExpanded}
      >
        <Box sx={{ height: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <DesktopNavigationHeader
            compact={false}
            collapsible={false}
            controlsId={mobileNavigationId}
            onDismiss={mobileNavigation.dismiss}
            onToggle={() => undefined}
          />
          <Box
            component="nav"
            aria-label={t('navigation.label')}
            sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.5 }}
          >
            <ActionButton
              component={NavLink}
              to="/apps"
              fullWidth
              intent="quiet"
              startIcon={<AppWindow size={18} strokeWidth={1.8} aria-hidden="true" />}
              aria-current="page"
              onClick={mobileNavigation.navigate}
              sx={{ justifyContent: 'flex-start' }}
            >
              {t('navigation.items.apps')}
            </ActionButton>
          </Box>
        </Box>
      </ShellMobileNavigationDrawer>
      <ShellHeader
        testId="catalog-header"
        shellKey={shell.key}
        scope={shell.scope}
        context={{ icon: AppWindow, label: t('navigation.items.apps') }}
        navigation={{
          controlsId: mobileNavigationId,
          expanded: mobileNavigation.open,
          label: t('navigation.open'),
          testId: 'catalog-mobile-navigation-trigger',
          onOpen: mobileNavigation.openFrom,
        }}
        showWorkspace={shell.showWorkspace}
        brand={
          <BrandLockup
            variant="full"
            sx={{ display: { xs: 'none', lg: 'inline-flex' }, flexShrink: 0 }}
          />
        }
      />
      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        sx={{ pt: `${shellHeaderHeight}px`, minHeight: '100dvh', minWidth: 0, outline: 'none' }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
