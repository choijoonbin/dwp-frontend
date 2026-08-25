import { Outlet } from 'react-router-dom';

import Box from '@mui/material/Box';

import { BrandLockup } from '../components/brand-lockup';
import { HOME_LIGHT_CANVAS, HOME_LIGHT_SURFACE } from '../components/home-surface-tokens';
import { ShellHeader } from '../components/shell-header';
import { shellRegistry } from '../features/shell/shell-registry';

export function HomeLayout() {
  const shell = shellRegistry.home;

  return (
    <Box
      data-testid="personal-home-shell"
      sx={{
        '--home-canvas': (theme) =>
          theme.palette.mode === 'dark' ? theme.palette.background.default : HOME_LIGHT_CANVAS,
        '--home-surface': (theme) =>
          theme.palette.mode === 'dark' ? theme.palette.background.paper : HOME_LIGHT_SURFACE,
        '--home-surface-subtle': (theme) =>
          theme.palette.mode === 'dark' ? theme.palette.background.default : '#FAFBFC',
        '--home-radius-section': '16px',
        '--home-radius-item': '12px',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'background.default' : HOME_LIGHT_CANVAS,
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
        maxContentWidth={2560}
        sx={{
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'background.paper' : HOME_LIGHT_SURFACE,
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          '& .MuiToolbar-root': { minHeight: '63px !important', px: { xs: 2, md: '24px' } },
        }}
        brand={
          <>
            <BrandLockup
              variant="condensed"
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
        sx={{
          minWidth: 0,
          minHeight: 0,
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
