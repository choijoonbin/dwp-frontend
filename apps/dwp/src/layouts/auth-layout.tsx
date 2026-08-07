import { Outlet } from 'react-router-dom';
import { ProductMark } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export function AuthLayout() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 0.8fr) minmax(480px, 1.2fr)' },
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          minHeight: '100dvh',
          p: 6,
          flexDirection: 'column',
          justifyContent: 'space-between',
          bgcolor: '#20252B',
          color: '#FFFFFF',
          borderRight: '4px solid',
          borderColor: 'secondary.main',
        }}
      >
        <ProductMark sx={{ color: '#FFFFFF' }} />
        <Box sx={{ maxWidth: 460 }}>
          <Typography component="p" variant="h2" sx={{ color: 'inherit' }}>
            Digital Workplace
          </Typography>
          <Typography sx={{ mt: 2, color: '#DCE1E7', maxWidth: 420 }}>
            Secure access to work, services, knowledge, and governed AI.
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: '#CBD2D9' }}>
          DWP Enterprise Platform
        </Typography>
      </Box>

      <Box
        sx={{
          width: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, sm: 6 },
          py: 8,
        }}
      >
        <Box sx={{ width: 1, maxWidth: 420 }}>
          <ProductMark sx={{ mb: 6, display: { lg: 'none' } }} />
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
