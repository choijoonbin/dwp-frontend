import { useTranslation } from 'react-i18next';
import { ProductMark } from '@dwp-frontend/design-system/components/product-mark';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import {
  resolveShellKey,
  shellHeaderHeight,
  shellRegistry,
} from '../features/shell/shell-registry';
import { HomeLoadingSkeleton } from './home-loading-skeleton';

type ShellBootScreenProps = {
  pathname?: string;
};

export function ShellBootScreen({
  pathname = typeof window === 'undefined' ? '/' : window.location.pathname,
}: ShellBootScreenProps) {
  const { t } = useTranslation('common');
  const shellKey = resolveShellKey(pathname) ?? 'home';
  const shell = shellRegistry[shellKey];
  const sidebarWidth = shell.desktopNavigationWidth;
  const hasSidebar = sidebarWidth > 0;
  const homeShell = shellKey === 'home';

  const shimmer = {
    bgcolor: 'action.hover',
    animation: 'dwp-shell-boot-pulse 1.25s ease-in-out infinite alternate',
    '@keyframes dwp-shell-boot-pulse': {
      from: { opacity: 0.45 },
      to: { opacity: 0.9 },
    },
    '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.7 },
  } as const;

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="shell-boot-screen"
      data-dwp-shell={shell.key}
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      {hasSidebar && (
        <Box
          component="aside"
          data-testid="shell-boot-sidebar"
          aria-hidden="true"
          sx={{
            position: 'fixed',
            inset: '0 auto 0 0',
            width: sidebarWidth,
            display: { xs: 'none', lg: 'block' },
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ height: shellHeaderHeight, px: 2, display: 'flex', alignItems: 'center' }}>
            <ProductMark compact={shellKey === 'catalog'} />
          </Box>
          <Box sx={{ px: 2, py: 2, display: 'grid', gap: 1.25 }}>
            {[72, 86, 64, 78].map((width) => (
              <Box
                key={width}
                sx={{ ...shimmer, width: `${width}%`, height: 14, borderRadius: 0.75 }}
              />
            ))}
          </Box>
        </Box>
      )}

      <Box
        component="header"
        data-testid="shell-boot-header"
        aria-hidden="true"
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          left: { xs: 0, lg: sidebarWidth },
          height: shellHeaderHeight,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: homeShell ? { xs: 2, md: '50px' } : { xs: 1.5, md: 2 },
          bgcolor: (theme) =>
            homeShell && theme.palette.mode !== 'dark' ? '#FAF8FF' : 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          fontFamily: homeShell
            ? '"Hanken Grotesk", "Noto Sans KR", system-ui, sans-serif'
            : undefined,
        }}
      >
        {!hasSidebar && homeShell && (
          <>
            <ProductMark compact sx={{ display: { xs: 'inline-flex', md: 'none' } }} />
            <ProductMark sx={{ display: { xs: 'none', md: 'inline-flex' } }} />
          </>
        )}
        {!hasSidebar && !homeShell && <ProductMark compact={false} />}
        {hasSidebar && <Box sx={{ ...shimmer, width: 132, height: 24, borderRadius: 0.75 }} />}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ ...shimmer, width: { xs: 38, md: 184 }, height: 38, borderRadius: 1 }} />
        <Box sx={{ ...shimmer, width: 38, height: 38, borderRadius: '50%' }} />
      </Box>

      {homeShell ? (
        <Box component="main" id="dwp-main-content" tabIndex={-1} data-testid="shell-boot-main">
          <HomeLoadingSkeleton reserveHeader />
        </Box>
      ) : (
        <Box
          component="main"
          id="dwp-main-content"
          tabIndex={-1}
          data-testid="shell-boot-main"
          sx={{
            pt: `${shellHeaderHeight + 32}px`,
            px: { xs: 2, md: 4 },
            ml: { xs: 0, lg: `${sidebarWidth}px` },
            display: 'grid',
            gap: 2,
            outline: 'none',
          }}
        >
          <Box sx={{ ...shimmer, width: { xs: '58%', md: 280 }, height: 24, borderRadius: 0.75 }} />
          <Box sx={{ ...shimmer, width: { xs: '86%', md: 520 }, height: 14, borderRadius: 0.75 }} />
          <Box sx={{ ...shimmer, width: 1, height: 1, minHeight: 220, borderRadius: 1 }} />
        </Box>
      )}

      <Typography
        sx={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        {t('labels.loadingPage')}
      </Typography>
    </Box>
  );
}
