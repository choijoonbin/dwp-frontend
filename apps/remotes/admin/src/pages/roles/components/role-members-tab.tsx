// ----------------------------------------------------------------------

import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { Iconify , EmptyState, PermissionGate } from '@dwp-frontend/design-system';
import {
  HttpError,
  useAdminUsersQuery,
  useAdminRoleMembersQuery,
  useUpdateAdminRoleMembersMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useRoleMembersState } from '../hooks/use-role-members-state';

// ----------------------------------------------------------------------

type RoleMembersTabProps = {
  roleId: string;
  onSuccess: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveRequest?: (handler: () => Promise<void>) => void;
};

export const RoleMembersTab = memo(({ roleId, onSuccess, onDirtyChange, onSaveRequest }: RoleMembersTabProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: roleMembers, isLoading } = useAdminRoleMembersQuery(roleId);
  const { data: allUsers } = useAdminUsersQuery({ size: 1000 });
  const updateMutation = useUpdateAdminRoleMembersMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [memberTypeFilter, setMemberTypeFilter] = useState<'ALL' | 'USER' | 'DEPARTMENT'>('ALL');
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);

  const {
    selectedUserIds,
    dialogOpen,
    errorSnackbar,
    handleToggleUser,
    handleOpenDialog,
    handleCloseDialog,
    showErrorSnackbar,
    closeErrorSnackbar,
    setSelectedUserIds,
  } = useRoleMembersState(roleId);

  // Filter members
  const filteredMembers = useMemo(() => {
    if (!roleMembers) return [];
    return roleMembers.filter((member) => {
      const matchesSearch =
        searchQuery === '' ||
        member.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.subjectEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.departmentName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        memberTypeFilter === 'ALL' ||
        (memberTypeFilter === 'USER' && member.subjectType === 'USER') ||
        (memberTypeFilter === 'DEPARTMENT' && member.subjectType === 'DEPARTMENT');

      return matchesSearch && matchesType;
    });
  }, [roleMembers, searchQuery, memberTypeFilter]);

  // Available users (not in role)
  const availableUsers = useMemo(() => {
    if (!allUsers?.items) return [];
    return allUsers.items.filter((user) => !roleMembers?.find((m) => m.id === user.id && m.subjectType === 'USER'));
  }, [allUsers, roleMembers]);

  const userCount = roleMembers?.filter((m) => m.subjectType === 'USER').length ?? 0;
  const departmentCount = roleMembers?.filter((m) => m.subjectType === 'DEPARTMENT').length ?? 0;

  const handleSubmit = useCallback(async () => {
    try {
      await updateMutation.mutateAsync({
        roleId,
        payload: {
          userIds: Array.from(selectedUserIds),
        },
      });
      handleCloseDialog();
      onDirtyChange?.(false);
      onSuccess();
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        showErrorSnackbar('멤버 할당 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } else if (err instanceof HttpError && err.status === 403) {
        showErrorSnackbar('접근 권한이 없습니다.');
      } else {
        showErrorSnackbar(err instanceof Error ? err.message : '멤버 할당에 실패했습니다.');
      }
      throw err;
    }
  }, [roleId, selectedUserIds, updateMutation, handleCloseDialog, onDirtyChange, onSuccess, showErrorSnackbar]);

  // Register save handler
  useEffect(() => {
    onSaveRequest?.(handleSubmit);
  }, [handleSubmit, onSaveRequest]);

  // Track dirty state - only when dialog is open
  useEffect(() => {
    if (!dialogOpen) {
      onDirtyChange?.(false);
      return;
    }
    if (roleMembers) {
      const currentIds = new Set(roleMembers.map((m) => m.id));
      const hasChanges =
        selectedUserIds.size !== currentIds.size ||
        Array.from(selectedUserIds).some((id) => !currentIds.has(id)) ||
        Array.from(currentIds).some((id) => !selectedUserIds.has(id));
      onDirtyChange?.(hasChanges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserIds, roleMembers, dialogOpen]); // Remove onDirtyChange from deps to prevent infinite loop

  const handleAddUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
    setAddPopoverOpen(false);
  };

  const handleRemoveMember = (memberId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
    onDirtyChange?.(true);
  };

  if (isLoading) {
    return <Skeleton variant="rectangular" height={200} />;
  }

  return (
    <>
      <Stack spacing={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              멤버 관리
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              총 {userCount}명 / {departmentCount}팀이 할당되어 있습니다
            </Typography>
          </Stack>

          <PermissionGate resource="menu.admin.roles" permission="MANAGE">
            <Button
              size="small"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={handleOpenDialog}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              멤버 추가
            </Button>
          </PermissionGate>
        </Stack>

        {/* Filters */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            size="small"
            placeholder="이름, 이메일로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <Iconify icon="solar:magnifer-bold" width={20} sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flex: 1 }}
          />
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button
              size="small"
              variant={memberTypeFilter === 'ALL' ? 'contained' : 'outlined'}
              onClick={() => setMemberTypeFilter('ALL')}
            >
              전체
            </Button>
            <Button
              size="small"
              variant={memberTypeFilter === 'USER' ? 'contained' : 'outlined'}
              onClick={() => setMemberTypeFilter('USER')}
            >
              사용자
            </Button>
            <Button
              size="small"
              variant={memberTypeFilter === 'DEPARTMENT' ? 'contained' : 'outlined'}
              onClick={() => setMemberTypeFilter('DEPARTMENT')}
              disabled
            >
              부서
            </Button>
          </Stack>
        </Stack>

        {/* Member List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {filteredMembers.length === 0 ? (
            <EmptyState
              title={roleMembers && roleMembers.length === 0 ? '할당된 멤버가 없습니다' : '검색 결과가 없습니다'}
              description={
                roleMembers && roleMembers.length === 0
                  ? "상단의 '멤버 추가' 버튼을 클릭하여 사용자를 추가하세요"
                  : '다른 검색어를 입력해보세요'
              }
              icon={<Iconify icon="solar:users-group-rounded-bold-duotone" width={28} />}
              action={
                roleMembers && roleMembers.length === 0 ? (
                  <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleOpenDialog}>
                    멤버 추가
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Stack spacing={1}>
              {filteredMembers.map((member, index) => (
                <Paper
                  key={`${member.id}-${index}`}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1.5, sm: 0 },
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: 'primary.lighter',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Iconify
                        icon={member.subjectType === 'USER' ? 'solar:user-bold' : 'solar:buildings-bold'}
                        width={20}
                        sx={{ color: member.subjectType === 'USER' ? 'primary.main' : 'warning.main' }}
                      />
                    </Box>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {member.subjectName}
                        </Typography>
                        <Chip
                          label={member.subjectType === 'USER' ? '사용자' : '부서'}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            ...(member.subjectType === 'USER'
                              ? { bgcolor: 'primary.lighter', color: 'primary.main' }
                              : { bgcolor: 'warning.lighter', color: 'warning.main' }),
                          }}
                        />
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {member.subjectType === 'USER'
                          ? member.subjectEmail || member.subjectCode || ''
                          : member.subjectCode || ''}
                        {member.departmentName && member.subjectType === 'USER' && ` · ${member.departmentName}`}
                      </Typography>
                    </Box>
                  </Stack>
                  <PermissionGate resource="menu.admin.roles" permission="MANAGE">
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveMember(member.id)}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' }, alignSelf: { xs: 'flex-end', sm: 'center' } }}
                    >
                      <Iconify icon="solar:close-circle-bold" width={20} />
                    </IconButton>
                  </PermissionGate>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>

        {/* Footer Stats */}
        {roleMembers && roleMembers.length > 0 && (
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                표시: {filteredMembers.length}건
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                전체: {roleMembers.length}건
              </Typography>
            </Stack>
          </Box>
        )}
      </Stack>

      {/* Member Management Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth fullScreen={fullScreen}>
        <DialogTitle>멤버 할당</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Autocomplete
              options={availableUsers}
              getOptionLabel={(option) => `${option.userName}${option.email ? ` (${option.email})` : ''}`}
              renderInput={(params) => <TextField {...params} placeholder="사용자 검색..." size="small" />}
              onChange={(_, value) => {
                if (value) handleAddUser(value.id);
              }}
              open={addPopoverOpen}
              onOpen={() => setAddPopoverOpen(true)}
              onClose={() => setAddPopoverOpen(false)}
            />

            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {allUsers?.items.map((user) => (
                <Box
                  key={user.id}
                  sx={{
                    p: 1,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Iconify icon="solar:user-bold" width={20} sx={{ color: 'text.secondary' }} />
                    <Box>
                      <Typography variant="body2">{user.userName}</Typography>
                      {user.email && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {user.email}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <Button
                    size="small"
                    onClick={() => handleToggleUser(user.id)}
                    variant={selectedUserIds.has(user.id) ? 'contained' : 'outlined'}
                  >
                    {selectedUserIds.has(user.id) ? '선택됨' : '선택'}
                  </Button>
                </Box>
              ))}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <PermissionGate resource="menu.admin.roles" permission="MANAGE">
            <Button variant="contained" onClick={handleSubmit} disabled={updateMutation.isPending}>
              저장
            </Button>
          </PermissionGate>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={errorSnackbar.open}
        autoHideDuration={6000}
        onClose={closeErrorSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={closeErrorSnackbar} severity="error" sx={{ width: '100%' }}>
          {errorSnackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
});

RoleMembersTab.displayName = 'RoleMembersTab';
