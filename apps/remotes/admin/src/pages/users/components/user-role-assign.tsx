// ----------------------------------------------------------------------

import { memo, useState, useEffect } from 'react';
import { useAdminUserRolesQuery, useAdminRolesQuery } from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

type UserRoleAssignProps = {
  open: boolean;
  userId: string;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (roleIds: string[], replace: boolean) => Promise<boolean>;
};

export const UserRoleAssign = memo(({ open, userId, isLoading, onClose, onSubmit }: UserRoleAssignProps) => {
  const { data: userRoles } = useAdminUserRolesQuery(userId);
  const { data: allRoles } = useAdminRolesQuery({ size: 1000 });
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState(true);

  // Initialize selected roles from userRoles
  useEffect(() => {
    if (userRoles) {
      setSelectedRoleIds(new Set(userRoles.map((r) => r.id)));
    }
  }, [userRoles]);

  const handleToggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const success = await onSubmit(Array.from(selectedRoleIds), replace);
    if (success) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>역할 할당</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={replace} onChange={(e) => setReplace(e.target.checked)} />}
            label="기존 역할을 모두 교체 (replace mode)"
          />
          {allRoles?.items.map((role) => (
            <FormControlLabel
              key={role.id}
              control={
                <Checkbox checked={selectedRoleIds.has(role.id)} onChange={() => handleToggleRole(role.id)} />
              }
              label={role.roleName}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isLoading}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
});

UserRoleAssign.displayName = 'UserRoleAssign';
