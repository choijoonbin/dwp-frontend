// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export const MenuDetailEmptyState = memo(() => (
  <Card
    sx={{
      p: 4,
      textAlign: 'center',
      width: 1,
      height: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Box
      sx={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mx: 'auto',
        mb: 2,
      }}
    >
      <Iconify icon="solar:folder-bold" width={28} sx={{ color: 'text.disabled' }} />
    </Box>
    <Typography variant="h6">메뉴를 선택하세요</Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
      왼쪽 트리에서 메뉴를 선택하면 상세 정보를 확인하고 편집할 수 있습니다.
    </Typography>
  </Card>
));

MenuDetailEmptyState.displayName = 'MenuDetailEmptyState';
