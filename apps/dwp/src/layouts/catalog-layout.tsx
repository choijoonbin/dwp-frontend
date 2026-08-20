import { AppWindow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import Box from '@mui/material/Box';

import { BrandLockup } from '../components/brand-lockup';
import { ShellHeader } from '../components/shell-header';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';

export function CatalogLayout() {
  const { t } = useTranslation('shell');
  const shell = shellRegistry.catalog;
  return (
    <Box data-testid="catalog-shell" sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <ShellHeader
        testId="catalog-header"
        shellKey={shell.key}
        scope={shell.scope}
        context={{ icon: AppWindow, label: t('navigation.items.apps') }}
        showWorkspace={shell.showWorkspace}
        brand={<BrandLockup variant="full" />}
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
