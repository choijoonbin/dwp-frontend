// ----------------------------------------------------------------------

import { memo, useMemo, useState, useEffect } from 'react';
import { PermissionGate } from '@dwp-frontend/design-system';
import {
  trackEvent,
  toSelectOptions,
  getCodesByGroupFromMap,
  useCodesByResourceQuery,
  useCreateAdminRoleMutation,
} from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import useMediaQuery from '@mui/material/useMediaQuery';

// ----------------------------------------------------------------------

type CreateRoleModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const CreateRoleModal = memo(({ open, onClose, onSuccess }: CreateRoleModalProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [formData, setFormData] = useState({
    roleName: '',
    roleCode: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const createMutation = useCreateAdminRoleMutation();

  // Get codes for status options
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.roles');
  const roleStatusOptions = useMemo(() => {
    const codes = getCodesByGroupFromMap(codeMap, 'ROLE_STATUS');
    return toSelectOptions(codes);
  }, [codeMap]);

  useEffect(() => {
    if (open) {
      setFormData({
        roleName: '',
        roleCode: '',
        description: '',
        status: 'ACTIVE',
      });
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      trackEvent({
        resourceKey: 'btn.admin.roles.create',
        action: 'CLICK',
        label: '역할 생성',
        metadata: {
          page: window.location.pathname,
          roleName: formData.roleName,
        },
      });

      await createMutation.mutateAsync({
        roleName: formData.roleName,
        roleCode: formData.roleCode,
        description: formData.description || undefined,
        status: formData.status,
      });

      trackEvent({
        resourceKey: 'menu.admin.roles',
        action: 'CREATE_ROLE',
        label: '역할 생성 완료',
        metadata: {
          roleName: formData.roleName,
          status: formData.status,
        },
      });

      onSuccess();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle>새 역할 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="역할명 *"
            fullWidth
            value={formData.roleName}
            onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
            required
          />
          <TextField
            label="역할 코드 *"
            fullWidth
            value={formData.roleCode}
            onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
            required
          />
          <TextField
            label="설명"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            select
            label="상태"
            fullWidth
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
            disabled={!roleStatusOptions.length || codesLoading}
            helperText={
              codesLoading
                ? '코드 로딩 중...'
                : !roleStatusOptions.length
                  ? '코드 매핑 필요 (ROLE_STATUS)'
                  : undefined
            }
          >
            {roleStatusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <PermissionGate resource="menu.admin.roles" permission="CREATE">
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.roleName || !formData.roleCode || createMutation.isPending}
          >
            생성
          </Button>
        </PermissionGate>
      </DialogActions>
    </Dialog>
  );
});

CreateRoleModal.displayName = 'CreateRoleModal';
