// ----------------------------------------------------------------------

import { memo, useState, useEffect } from 'react';
import { useAdminRolesQuery, useAdminUserRolesQuery } from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
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
  const { data: userRoles } = useAdminUserRolesQuery(userId, { enabled: open && Boolean(userId) });
  const { data: allRoles, isLoading: allRolesLoading } = useAdminRolesQuery({ size: 1000 });
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState(true);

  // 사용자 현재 역할 로드 시 해당 역할 체크
  useEffect(() => {
    if (userRoles && Array.isArray(userRoles)) {
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: { sx: { zIndex: 9999 } },
      }}
    >
      <DialogTitle>역할 할당</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={replace} onChange={(e) => setReplace(e.target.checked)} />}
            label="기존 역할을 모두 교체 (replace mode)"
          />
          {allRolesLoading && (
            <Typography variant="body2" color="text.secondary">
              역할 목록 불러오는 중...
            </Typography>
          )}
          {!allRolesLoading && (!allRoles?.items?.length) && (
            <Typography variant="body2" color="text.secondary">
              등록된 역할이 없습니다.
            </Typography>
          )}
          {!allRolesLoading && allRoles?.items?.map((role) => (
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
