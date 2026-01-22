// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

// ----------------------------------------------------------------------

type MenuDetailHeaderProps = {
  menu: AdminMenuNode;
  enabled: boolean;
  isFolder: boolean;
  onClose?: () => void;
};

export const MenuDetailHeader = memo(({
  menu,
  enabled,
  isFolder,
  onClose,
}: MenuDetailHeaderProps) => (
  <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: isFolder ? 'warning.lighter' : 'info.lighter',
          }}
        >
          <Iconify
            icon={isFolder ? 'solar:folder-bold' : 'solar:document-text-bold'}
            width={22}
            sx={{ color: isFolder ? 'warning.main' : 'info.main' }}
          />
        </Box>
        <Box>
          <Typography variant="h6">{menu.menuName}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
            {menu.menuKey}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          label={enabled ? '활성' : '비활성'}
          color={enabled ? 'success' : 'default'}
          variant={enabled ? 'filled' : 'outlined'}
          size="small"
        />
        {isFolder && (
          <Chip label="폴더" size="small" variant="outlined" sx={{ color: 'warning.main' }} />
        )}
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <Iconify icon="solar:close-circle-bold" width={18} />
          </IconButton>
        )}
      </Stack>
    </Stack>
  </Box>
));

MenuDetailHeader.displayName = 'MenuDetailHeader';
