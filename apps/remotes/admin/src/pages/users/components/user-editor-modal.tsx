// ----------------------------------------------------------------------

import { memo } from 'react';
import { PermissionGate } from '@dwp-frontend/design-system';
import { getEmailError, useCodesByResourceQuery, getSelectOptionsByGroup } from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import type { UserFormState } from '../types';

// ----------------------------------------------------------------------

type UserEditorModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  formData: UserFormState;
  validationErrors: Record<string, string>;
  isLoading: boolean;
  onClose: () => void;
  onFormChange: <K extends keyof UserFormState>(field: K, value: UserFormState[K]) => void;
  onSubmit: () => void;
};

export const UserEditorModal = memo(({
  open,
  mode,
  formData,
  validationErrors,
  isLoading,
  onClose,
  onFormChange,
  onSubmit,
}: UserEditorModalProps) => {
  // Get codes for status options
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.users');
  const userStatusOptions = getSelectOptionsByGroup(codeMap, 'USER_STATUS');

  const isCreateMode = mode === 'create';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isCreateMode ? '사용자 추가' : '사용자 편집'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="사용자명 *"
            fullWidth
            value={formData.userName}
            onChange={(e) => onFormChange('userName', e.target.value)}
            required
            error={!!validationErrors.userName}
            helperText={validationErrors.userName}
          />
          <TextField
            label="이메일"
            type="email"
            fullWidth
            value={formData.email}
            onChange={(e) => {
              onFormChange('email', e.target.value);
            }}
            error={!!validationErrors.email}
            helperText={validationErrors.email || (formData.email ? getEmailError(formData.email) : undefined)}
          />
          {isCreateMode && (
            <FormControlLabel
              control={
                <Switch
                  checked={formData.createLocalAccount}
                  onChange={(e) => onFormChange('createLocalAccount', e.target.checked)}
                />
              }
              label="로컬 계정 생성"
            />
          )}
          {isCreateMode && formData.createLocalAccount && (
            <>
              <TextField
                label="Principal"
                fullWidth
                value={formData.principal}
                onChange={(e) => onFormChange('principal', e.target.value)}
              />
              <TextField
                label="비밀번호"
                type="password"
                fullWidth
                value={formData.password}
                onChange={(e) => onFormChange('password', e.target.value)}
                error={!!validationErrors.password}
                helperText={validationErrors.password}
                required={formData.createLocalAccount}
              />
            </>
          )}
          {!isCreateMode && (
            <TextField
              select
              label="상태"
              fullWidth
              value={formData.status}
              onChange={(e) => onFormChange('status', e.target.value as 'ACTIVE' | 'INACTIVE')}
              disabled={codesLoading || userStatusOptions.length === 0}
              helperText={
                codesLoading
                  ? '코드 로딩 중...'
                  : userStatusOptions.length === 0
                    ? '코드 매핑 필요 (USER_STATUS)'
                    : undefined
              }
            >
              {userStatusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <PermissionGate resource="menu.admin.users" permission={isCreateMode ? 'CREATE' : 'UPDATE'}>
          <Button variant="contained" onClick={onSubmit} disabled={!formData.userName || isLoading}>
            {isCreateMode ? '생성' : '저장'}
          </Button>
        </PermissionGate>
      </DialogActions>
    </Dialog>
  );
});

UserEditorModal.displayName = 'UserEditorModal';
