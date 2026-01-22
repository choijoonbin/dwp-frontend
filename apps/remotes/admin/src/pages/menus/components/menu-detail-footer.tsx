// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

// ----------------------------------------------------------------------

type MenuDetailFooterProps = {
  isLoading: boolean;
  onReset: () => void;
  onSave: () => void;
};

export const MenuDetailFooter = memo(({
  isLoading,
  onReset,
  onSave,
}: MenuDetailFooterProps) => (
  <Box
    sx={{
      p: 2.5,
      borderTop: 1,
      borderColor: 'divider',
      bgcolor: 'action.hover',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 1,
    }}
  >
    <Button variant="outlined" onClick={onReset} disabled={isLoading}>
      취소
    </Button>
    <PermissionGate resource="menu.admin.menus" permission="UPDATE">
      <Button
        variant="contained"
        onClick={onSave}
        disabled={isLoading}
        startIcon={<Iconify icon="solar:diskette-bold" width={16} />}
      >
        저장
      </Button>
    </PermissionGate>
  </Box>
));

MenuDetailFooter.displayName = 'MenuDetailFooter';
