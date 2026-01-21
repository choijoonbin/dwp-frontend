// ----------------------------------------------------------------------

import { memo, useMemo, useState, useEffect } from 'react';
import { PermissionGate } from '@dwp-frontend/design-system';
import {
  trackEvent,
  toSelectOptions,
  type RoleSummary,
  getCodesByGroupFromMap,
  useCodesByResourceQuery,
  useCreateAdminRoleMutation,
  useUpdateAdminRoleMutation,
} from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

// ----------------------------------------------------------------------

type RoleEditorModalProps = {
  open: boolean;
  onClose: () => void;
  role: RoleSummary | null;
  onSuccess: () => void;
};

export const RoleEditorModal = memo(({ open, onClose, role, onSuccess }: RoleEditorModalProps) => {
  const [formData, setFormData] = useState({
    roleName: '',
    roleCode: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const createMutation = useCreateAdminRoleMutation();
  const updateMutation = useUpdateAdminRoleMutation();

  // Get codes for status options
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.roles');
  const roleStatusOptions = useMemo(() => {
    const codes = getCodesByGroupFromMap(codeMap, 'ROLE_STATUS');
    return toSelectOptions(codes);
  }, [codeMap]);

  useEffect(() => {
    if (role) {
      setFormData({
        roleName: role.roleName,
        roleCode: role.roleCode,
        description: role.description || '',
        status: role.status,
      });
    } else {
      setFormData({
        roleName: '',
        roleCode: '',
        description: '',
        status: 'ACTIVE',
      });
    }
  }, [role]);

  const handleSubmit = async () => {
    try {
      // Track button click event
      const actionDetail = role ? 'update_role' : 'create_role';
      const resourceKey = role ? 'btn.admin.roles.save' : 'btn.admin.roles.create';
      const label = role ? '저장' : '생성';

      trackEvent({
        resourceKey,
        action: 'CLICK',
        label,
        metadata: {
          page: window.location.pathname,
          roleId: role?.id,
          roleName: formData.roleName,
          actionDetail, // Store original action in metadata
        },
      });

      if (role) {
        await updateMutation.mutateAsync({
          roleId: role.id,
          payload: {
            roleName: formData.roleName,
            roleCode: formData.roleCode,
            description: formData.description || undefined,
            status: formData.status,
          },
        });
        trackEvent({
          resourceKey: 'menu.admin.roles',
          action: 'UPDATE_ROLE',
          label: '역할 수정 완료',
          metadata: {
            roleId: role.id,
            roleName: formData.roleName,
            status: formData.status,
          },
        });
      } else {
        await createMutation.mutateAsync({
          roleName: formData.roleName,
          roleCode: formData.roleCode,
          description: formData.description || undefined,
          status: formData.status,
        });
      }
      onSuccess();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{role ? '역할 편집' : '역할 추가'}</DialogTitle>
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
            disabled={!!role}
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
        <PermissionGate resource="menu.admin.roles" permission={role ? 'UPDATE' : 'CREATE'}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.roleName || !formData.roleCode || (createMutation.isPending || updateMutation.isPending)}
          >
            {role ? '저장' : '생성'}
          </Button>
        </PermissionGate>
      </DialogActions>
    </Dialog>
  );
});

RoleEditorModal.displayName = 'RoleEditorModal';
