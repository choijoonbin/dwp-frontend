// ----------------------------------------------------------------------

import { memo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Button from '@mui/material/Button';

import { RolePermissionsDialog } from './role-permissions-dialog';

// ----------------------------------------------------------------------

type RolePermissionsSectionProps = {
  roleId: string;
  onSuccess: () => void;
};

export const RolePermissionsSection = memo(({ roleId, onSuccess }: RolePermissionsSectionProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button size="small" startIcon={<Iconify icon="solar:shield-check-bold" />} onClick={() => setDialogOpen(true)}>
        관리
      </Button>
      <RolePermissionsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} roleId={roleId} onSuccess={onSuccess} />
    </>
  );
});

RolePermissionsSection.displayName = 'RolePermissionsSection';
