// ----------------------------------------------------------------------

import { useState } from 'react';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';
import {
  HttpError,
  ApiErrorAlert,
  type CodeGroup,
  useCreateCodeGroupMutation,
  useUpdateCodeGroupMutation,
  useDeleteCodeGroupMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';

import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { CodeGroupEditorModal } from './code-group-editor-modal';
import { useCodeGroupsTableState } from '../hooks/use-code-groups-table-state';

// ----------------------------------------------------------------------

export const CodeGroupsTab = () => {
  const {
    keyword,
    tenantScope,
    enabled,
    setKeyword,
    setTenantScope,
    setEnabled,
    filteredGroups,
    isLoading,
    error,
    refetch,
  } = useCodeGroupsTableState();

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CodeGroup | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const createMutation = useCreateCodeGroupMutation();
  const updateMutation = useUpdateCodeGroupMutation();
  const deleteMutation = useDeleteCodeGroupMutation();

  const handleCreateGroup = () => {
    setSelectedGroup(null);
    setGroupDialogOpen(true);
  };

  const handleEditGroup = (group: CodeGroup) => {
    setSelectedGroup(group);
    setGroupDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDeleteGroup = (group: CodeGroup) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleGroupMenuOpen = (event: React.MouseEvent<HTMLElement>, group: CodeGroup) => {
    setAnchorEl(event.currentTarget);
    setSelectedGroup(group);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSubmit = async (formData: {
    groupKey: string;
    groupName: string;
    description: string;
    tenantScope: 'COMMON' | 'TENANT';
    enabled: boolean;
  }) => {
    try {
      if (selectedGroup) {
        await updateMutation.mutateAsync({
          groupId: selectedGroup.id,
          payload: {
            groupKey: formData.groupKey,
            groupName: formData.groupName,
            description: formData.description || undefined,
            tenantScope: formData.tenantScope,
            enabled: formData.enabled,
          },
        });
        showSnackbar('코드 그룹이 수정되었습니다.');
      } else {
        await createMutation.mutateAsync({
          groupKey: formData.groupKey,
          groupName: formData.groupName,
          description: formData.description || undefined,
          tenantScope: formData.tenantScope,
          enabled: formData.enabled,
        });
        showSnackbar('코드 그룹이 생성되었습니다.');
      }
      setGroupDialogOpen(false);
      refetch();
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        showSnackbar('코드 그룹 키가 중복됩니다. 다른 키를 사용해주세요.', 'error');
      } else {
        showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedGroup) return;
    try {
      await deleteMutation.mutateAsync(selectedGroup.id);
      setDeleteDialogOpen(false);
      refetch();
      showSnackbar('코드 그룹이 삭제되었습니다.');
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        showSnackbar('코드가 포함된 그룹은 삭제할 수 없습니다. 코드를 먼저 삭제해주세요.', 'error');
      } else {
        showSnackbar(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error');
      }
    }
  };

  return (
    <>
      <Card>
        {/* Filter Bar */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <TextField
              label="검색"
              size="small"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              sx={{ minWidth: { xs: 1, md: 240 }, flex: 1 }}
              placeholder="그룹 키, 그룹명, 설명"
            />
            <TextField
              select
              label="스코프"
              size="small"
              value={tenantScope}
              onChange={(e) => setTenantScope(e.target.value as 'COMMON' | 'TENANT' | 'ALL')}
              sx={{ minWidth: { xs: 1, md: 140 } }}
            >
              <MenuItem value="ALL">전체</MenuItem>
              <MenuItem value="COMMON">공통</MenuItem>
              <MenuItem value="TENANT">테넌트</MenuItem>
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={enabled === undefined ? true : enabled}
                  onChange={(e) => setEnabled(e.target.checked ? undefined : !e.target.checked)}
                />
              }
              label="활성화만"
            />
            <Box sx={{ ml: { md: 'auto' }, width: { xs: 1, md: 'auto' } }}>
              <PermissionGate resource="menu.admin.codes" permission="CREATE">
                <Button
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={handleCreateGroup}
                  sx={{ width: { xs: 1, md: 'auto' }, minHeight: 40 }}
                >
                  그룹 추가
                </Button>
              </PermissionGate>
            </Box>
          </Stack>
        </Box>

        {/* Table */}
        {error ? (
          <Box sx={{ p: 2 }}>
            <ApiErrorAlert error={error} />
          </Box>
        ) : isLoading ? (
          <Box sx={{ p: 2 }}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : !filteredGroups || filteredGroups.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              데이터가 없습니다.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: { md: 640 }, overflowX: 'auto' }}>
            <Table stickyHeader sx={{ minWidth: 760, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ height: 56 }}>
                  <TableCell sx={{ minWidth: 180 }}>그룹 키</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>그룹명</TableCell>
                  <TableCell sx={{ width: 140 }}>스코프</TableCell>
                  <TableCell sx={{ width: 120 }}>상태</TableCell>
                  <TableCell align="right" sx={{ width: 72 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow key={group.id} sx={{ height: 48 }}>
                    <TableCell>
                      <Tooltip title={group.groupKey} placement="top-start">
                        <Typography variant="body2" noWrap>
                          {group.groupKey}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={group.groupName} placement="top-start">
                        <Typography variant="body2" noWrap>
                          {group.groupName}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={group.tenantScope === 'COMMON' ? '공통' : '테넌트'}
                        color={group.tenantScope === 'COMMON' ? 'primary' : 'secondary'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={group.enabled ? '활성' : '비활성'}
                        color={group.enabled ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => handleGroupMenuOpen(e, group)}>
                        <Iconify icon="solar:menu-dots-bold" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Group Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl) && Boolean(selectedGroup)} onClose={handleMenuClose}>
        <PermissionGate resource="menu.admin.codes" permission="UPDATE">
          <MenuItem onClick={() => selectedGroup && handleEditGroup(selectedGroup)}>
            <Iconify icon="solar:pen-bold" width={16} sx={{ mr: 1 }} />
            편집
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.codes" permission="DELETE">
          <MenuItem onClick={() => selectedGroup && handleDeleteGroup(selectedGroup)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </PermissionGate>
      </Menu>

      {/* Group Dialog */}
      <CodeGroupEditorModal
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        group={selectedGroup}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      {selectedGroup && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title="코드 그룹 삭제"
          content={`정말 "${selectedGroup.groupName}" 코드 그룹을 삭제하시겠습니까?`}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};
