import { Outlet } from 'react-router-dom';

import Box from '@mui/material/Box';

import { BrandLockup } from '../components/brand-lockup';
import { ShellHeader } from '../components/shell-header';
import { shellRegistry } from '../features/shell/shell-registry';

export function HomeLayout() {
  const shell = shellRegistry.home;

  return (
    <Box
      data-testid="personal-home-shell"
      sx={{
        minHeight: '100dvh',
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.default' : '#FAF8FF'),
        fontFamily: '"Hanken Grotesk", "Noto Sans KR", system-ui, sans-serif',
        '& .MuiTypography-root, & .MuiButtonBase-root, & .MuiChip-root': {
          fontFamily: 'inherit',
        },
      }}
    >
      <ShellHeader
        testId="home-header"
        shellKey={shell.key}
        scope={shell.scope}
        position={shell.headerPosition}
        surface={shell.headerSurface}
        showWorkspace={shell.showWorkspace}
        compactSearch
        maxContentWidth={2240}
        sx={{
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : '#FAF8FF'),
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          '& .MuiToolbar-root': { minHeight: '63px !important', px: { xs: 2, md: '50px' } },
        }}
        brand={
          <>
            <BrandLockup
              variant="product-only"
              sx={{ display: { xs: 'inline-flex', md: 'none' }, flexShrink: 0 }}
            />
            <BrandLockup
              variant="full"
              sx={{ display: { xs: 'none', md: 'inline-flex' }, flexShrink: 0 }}
            />
          </>
        }
      />

      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        data-testid="personal-home-main"
        sx={{ minWidth: 0, outline: 'none' }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
