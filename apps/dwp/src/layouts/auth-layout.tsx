import { Outlet } from 'react-router-dom';
import { Logo } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

export function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        px: 2,
        py: 10,
        backgroundImage: 'url(/assets/background/overlay.jpg)',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        '&::before': {
          position: 'absolute',
          inset: 0,
          content: '""',
          bgcolor: 'rgba(255, 255, 255, 0.82)',
        },
      }}
    >
      <Logo
        isSingle={false}
        expandedText="DWP"
        sx={{ position: 'absolute', zIndex: 1, top: 24, left: 24 }}
      />
      <Paper elevation={6} sx={{ zIndex: 1, width: '100%', maxWidth: 420, p: { xs: 3, sm: 5 } }}>
        <Outlet />
      </Paper>
    </Box>
  );
}
