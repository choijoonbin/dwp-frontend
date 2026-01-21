// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';
import {
  type RoleSummary,
  useAdminRoleDetailQuery,
  useAdminRoleMembersQuery,
  useAdminRolePermissionsQuery,
} from '@dwp-frontend/shared-utils';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { RoleMembersSection } from './role-members-section';
import { RolePermissionsMatrix } from './role-permissions-matrix';
import { RolePermissionsSection } from './role-permissions-section';

// ----------------------------------------------------------------------

type RoleDetailViewProps = {
  roleId: string;
  onEdit: (role: RoleSummary) => void;
  onDelete: (role: RoleSummary) => void;
  onSuccess: () => void;
};

export const RoleDetailView = memo(({ roleId, onEdit, onDelete, onSuccess }: RoleDetailViewProps) => {
  const { data: roleDetail, isLoading } = useAdminRoleDetailQuery(roleId);
  const { data: roleMembers, isLoading: membersLoading } = useAdminRoleMembersQuery(roleId);
  const { isLoading: permissionsLoading } = useAdminRolePermissionsQuery(roleId);

  if (isLoading) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={200} />
      </Card>
    );
  }

  if (!roleDetail) {
    return (
      <Card sx={{ p: 3 }}>
        <Alert severity="error">역할 정보를 불러올 수 없습니다.</Alert>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Role Info */}
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h6">{roleDetail.roleName}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {roleDetail.roleCode}
              </Typography>
              <Chip
                label={roleDetail.status === 'ACTIVE' ? '활성' : '비활성'}
                color={roleDetail.status === 'ACTIVE' ? 'success' : 'default'}
                size="small"
              />
            </Stack>
            {roleDetail.description && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                {roleDetail.description}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <PermissionGate resource="menu.admin.roles" permission="UPDATE">
              <Button size="small" startIcon={<Iconify icon="solar:pen-bold" />} onClick={() => onEdit(roleDetail)}>
                편집
              </Button>
            </PermissionGate>
            <PermissionGate resource="menu.admin.roles" permission="DELETE">
              <Button
                size="small"
                color="error"
                startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                onClick={() => onDelete(roleDetail)}
              >
                삭제
              </Button>
            </PermissionGate>
          </Stack>
        </Stack>
      </Card>

      {/* Members */}
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1">멤버</Typography>
          <PermissionGate resource="menu.admin.roles" permission="MANAGE">
            <RoleMembersSection roleId={roleId} onSuccess={onSuccess} />
          </PermissionGate>
        </Stack>
        {membersLoading ? (
          <Skeleton variant="rectangular" height={100} />
        ) : roleMembers && roleMembers.length > 0 ? (
          <Stack spacing={1}>
            {roleMembers.map((member) => (
              <Typography key={member.id} variant="body2">
                {member.userName}
                {member.email && ` (${member.email})`}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            멤버가 없습니다.
          </Typography>
        )}
      </Card>

      {/* Permissions */}
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1">권한</Typography>
          <PermissionGate resource="menu.admin.roles" permission="MANAGE">
            <RolePermissionsSection roleId={roleId} onSuccess={onSuccess} />
          </PermissionGate>
        </Stack>
        {permissionsLoading ? (
          <Skeleton variant="rectangular" height={200} />
        ) : (
          <RolePermissionsMatrix roleId={roleId} onSuccess={onSuccess} />
        )}
      </Card>
    </Stack>
  );
});

RoleDetailView.displayName = 'RoleDetailView';
