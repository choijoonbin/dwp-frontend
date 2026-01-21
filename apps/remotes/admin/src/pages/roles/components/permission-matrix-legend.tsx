// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export const PermissionMatrixLegend = memo(() => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      borderTop: 1,
      borderColor: 'divider',
      px: 3,
      py: 1.5,
      bgcolor: 'background.paper',
    }}
  >
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          bgcolor: 'success.lighter',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Iconify icon="solar:check-circle-bold" width={12} sx={{ color: 'success.main' }} />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        허용
      </Typography>
    </Stack>

    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          bgcolor: 'error.lighter',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Iconify icon="solar:close-circle-bold" width={12} sx={{ color: 'error.main' }} />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        거부
      </Typography>
    </Stack>

    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: 2,
          borderStyle: 'dashed',
          borderColor: 'divider',
        }}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        미설정
      </Typography>
    </Stack>

    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'warning.main',
        }}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        변경됨
      </Typography>
    </Stack>
  </Box>
));

PermissionMatrixLegend.displayName = 'PermissionMatrixLegend';
