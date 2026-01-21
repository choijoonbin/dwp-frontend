// ----------------------------------------------------------------------

import React, { memo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type PermissionValue = 'ALLOW' | 'DENY' | null;

type PermissionMatrixHeaderProps = {
  permissionCodes: Array<{ value: string; label: string }>;
  onColumnBulkAction: (permissionCode: string, value: PermissionValue) => void;
};

export const PermissionMatrixHeader = memo(({ permissionCodes, onColumnBulkAction }: PermissionMatrixHeaderProps) => {
  const [menuAnchorEl, setMenuAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({});

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, permissionCode: string) => {
    event.stopPropagation();
    setMenuAnchorEl((prev) => ({ ...prev, [permissionCode]: event.currentTarget }));
  };

  const handleMenuClose = (permissionCode: string) => {
    setMenuAnchorEl((prev) => ({ ...prev, [permissionCode]: null }));
  };

  const handleBulkAction = (permissionCode: string, value: PermissionValue) => {
    onColumnBulkAction(permissionCode, value);
    handleMenuClose(permissionCode);
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 1,
      }}
    >
      {/* Resource Column Header */}
      <Box
        sx={{
          position: 'sticky',
          left: 0,
          zIndex: 30,
          minWidth: 280,
          display: 'flex',
          alignItems: 'center',
          px: 3,
          py: 1.5,
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          리소스
        </Typography>
      </Box>

      {/* Permission Code Column Headers */}
      {permissionCodes.map((perm) => {
        const menuOpen = Boolean(menuAnchorEl[perm.value]);

        return (
          <Box key={perm.value}>
            <Tooltip title={`${perm.label} - 열 일괄 작업`} arrow>
              <Button
                onClick={(e) => handleMenuOpen(e, perm.value)}
                sx={{
                  width: 80,
                  minWidth: 80,
                  height: 56,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: 1,
                  borderColor: 'divider',
                  bgcolor: 'transparent',
                  color: 'text.primary',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {perm.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                  {perm.value}
                </Typography>
              </Button>
            </Tooltip>

            {/* Column Bulk Action Menu */}
            <Menu
              anchorEl={menuAnchorEl[perm.value] || null}
              open={menuOpen}
              onClose={() => handleMenuClose(perm.value)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
              <MenuItem onClick={() => handleBulkAction(perm.value, 'ALLOW')}>
                <Iconify icon="solar:check-circle-bold" width={18} sx={{ mr: 1, color: 'success.main' }} />
                모두 허용
              </MenuItem>
              <MenuItem onClick={() => handleBulkAction(perm.value, 'DENY')}>
                <Iconify icon="solar:close-circle-bold" width={18} sx={{ mr: 1, color: 'error.main' }} />
                모두 거부
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => handleBulkAction(perm.value, null)}>
                <Iconify icon="solar:restart-bold" width={18} sx={{ mr: 1 }} />
                모두 초기화
              </MenuItem>
            </Menu>
          </Box>
        );
      })}
    </Box>
  );
});

PermissionMatrixHeader.displayName = 'PermissionMatrixHeader';
