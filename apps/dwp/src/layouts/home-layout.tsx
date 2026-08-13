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
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      <ShellHeader
        testId="home-header"
        shellKey={shell.key}
        scope={shell.scope}
        position={shell.headerPosition}
        surface={shell.headerSurface}
        showWorkspace={shell.showWorkspace}
        brand={
          <>
            <BrandLockup variant="condensed" sx={{ display: { xs: 'inline-flex', sm: 'none' } }} />
            <BrandLockup sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
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
