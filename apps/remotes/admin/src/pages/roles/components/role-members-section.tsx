// ----------------------------------------------------------------------

import { memo, useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import {
  HttpError,
  useAdminUsersQuery,
  useAdminRoleMembersQuery,
  useUpdateAdminRoleMembersMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Snackbar from '@mui/material/Snackbar';
import Checkbox from '@mui/material/Checkbox';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

type RoleMembersSectionProps = {
  roleId: string;
  onSuccess: () => void;
};

export const RoleMembersSection = memo(({ roleId, onSuccess }: RoleMembersSectionProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorSnackbar, setErrorSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const { data: roleMembers } = useAdminRoleMembersQuery(roleId);
  const { data: allUsers } = useAdminUsersQuery({ size: 1000 });
  const updateMutation = useUpdateAdminRoleMembersMutation();

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (roleMembers) {
      setSelectedUserIds(new Set(roleMembers.map((u) => u.id)));
    }
  }, [roleMembers]);

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      await updateMutation.mutateAsync({
        roleId,
        payload: {
          userIds: Array.from(selectedUserIds),
        },
      });
      setDialogOpen(false);
      onSuccess();
    } catch (error) {
      // Handle 409 Conflict (ROLE_IN_USE or similar)
      if (error instanceof HttpError && error.status === 409) {
        setErrorSnackbar({ open: true, message: '멤버 할당 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
      } else if (error instanceof HttpError && error.status === 403) {
        setErrorSnackbar({ open: true, message: '접근 권한이 없습니다.' });
      } else {
        setErrorSnackbar({ open: true, message: error instanceof Error ? error.message : '멤버 할당에 실패했습니다.' });
      }
    }
  };

  return (
    <>
      <Button size="small" startIcon={<Iconify icon="solar:users-group-rounded-bold" />} onClick={() => setDialogOpen(true)}>
        관리
      </Button>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>멤버 할당</DialogTitle>
        <DialogContent>
          <Box sx={{ maxHeight: 400, overflow: 'auto', mt: 2 }}>
            {allUsers?.items.map((user) => (
              <FormControlLabel
                key={user.id}
                control={<Checkbox checked={selectedUserIds.has(user.id)} onChange={() => handleToggleUser(user.id)} />}
                label={`${user.userName}${user.email ? ` (${user.email})` : ''}`}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={updateMutation.isPending}>
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={errorSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setErrorSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setErrorSnackbar({ open: false, message: '' })} severity="error" sx={{ width: '100%' }}>
          {errorSnackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
});

RoleMembersSection.displayName = 'RoleMembersSection';
