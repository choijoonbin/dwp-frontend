// ----------------------------------------------------------------------

import { memo, useState } from 'react';
import { useResetAdminUserPasswordMutation } from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

// ----------------------------------------------------------------------

type ResetPasswordDialogProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onSuccess: (temporaryPassword?: string) => void;
};

export const ResetPasswordDialog = memo(({ open, onClose, userId, userName, onSuccess }: ResetPasswordDialogProps) => {
  const [newPassword, setNewPassword] = useState('');
  const resetMutation = useResetAdminUserPasswordMutation();

  const handleSubmit = async () => {
    try {
      const res = await resetMutation.mutateAsync({
        userId,
        payload: newPassword ? { newPassword } : undefined,
      });
      onSuccess(res.temporaryPassword);
      setNewPassword('');
    } catch (error) {
      // Error will be shown via Snackbar in parent component
      console.error('Failed to reset password:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>비밀번호 초기화</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {userName} 사용자의 비밀번호를 초기화합니다.
          </Typography>
          <TextField
            label="새 비밀번호 (선택사항)"
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="비워두면 임시 비밀번호가 자동 생성됩니다."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={resetMutation.isPending}>
          초기화
        </Button>
      </DialogActions>
    </Dialog>
  );
});

ResetPasswordDialog.displayName = 'ResetPasswordDialog';
