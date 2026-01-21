// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';
import {
  type Code,
  HttpError,
  ApiErrorAlert,
  useCodeGroupsQuery,
  useCreateCodeMutation,
  useUpdateCodeMutation,
  useDeleteCodeMutation,
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
import FormControlLabel from '@mui/material/FormControlLabel';

import { CodeEditorModal } from './code-editor-modal';
import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { useCodesTableState } from '../hooks/use-codes-table-state';

// ----------------------------------------------------------------------

export const CodesTab = () => {
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('');
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { data: groups, isLoading: groupsLoading } = useCodeGroupsQuery();
  const {
    keyword,
    tenantScope,
    enabled,
    setKeyword,
    setTenantScope,
    setEnabled,
    filteredCodes,
    isLoading: codesLoading,
    error: codesError,
    refetch: refetchCodes,
  } = useCodesTableState(selectedGroupKey);

  const createMutation = useCreateCodeMutation();
  const updateMutation = useUpdateCodeMutation();
  const deleteMutation = useDeleteCodeMutation();

  // Select first group by default
  useEffect(() => {
    if (groups && groups.length > 0 && !selectedGroupKey) {
      setSelectedGroupKey(groups[0].groupKey);
    }
  }, [groups, selectedGroupKey]);

  const handleCreateCode = () => {
    if (!selectedGroupKey) return;
    setSelectedCode(null);
    setCodeDialogOpen(true);
  };

  const handleEditCode = (code: Code) => {
    setSelectedCode(code);
    setCodeDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDeleteCode = (code: Code) => {
    setSelectedCode(code);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleCodeMenuOpen = (event: React.MouseEvent<HTMLElement>, code: Code) => {
    setAnchorEl(event.currentTarget);
    setSelectedCode(code);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSubmit = async (formData: {
    codeKey: string;
    codeName: string;
    codeValue: string;
    description: string;
    sortOrder: string;
    tenantScope: 'COMMON' | 'TENANT';
    enabled: boolean;
  }) => {
    try {
      if (selectedCode) {
        await updateMutation.mutateAsync({
          codeId: selectedCode.id,
          payload: {
            codeKey: formData.codeKey,
            codeName: formData.codeName,
            codeValue: formData.codeValue || undefined,
            description: formData.description || undefined,
            sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
            tenantScope: formData.tenantScope,
            enabled: formData.enabled,
          },
        });
        showSnackbar('코드가 수정되었습니다.');
      } else {
        await createMutation.mutateAsync({
          groupKey: selectedGroupKey,
          codeKey: formData.codeKey,
          codeName: formData.codeName,
          codeValue: formData.codeValue || undefined,
          description: formData.description || undefined,
          sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
          tenantScope: formData.tenantScope,
          enabled: formData.enabled,
        });
        showSnackbar('코드가 생성되었습니다.');
      }
      setCodeDialogOpen(false);
      refetchCodes();
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        showSnackbar('코드 키가 중복됩니다. 다른 키를 사용해주세요.', 'error');
      } else {
        showSnackbar(error instanceof Error ? error.message : '저장에 실패했습니다.', 'error');
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCode) return;
    try {
      await deleteMutation.mutateAsync({
        codeId: selectedCode.id,
        groupKey: selectedCode.groupKey,
      });
      setDeleteDialogOpen(false);
      refetchCodes();
      showSnackbar('코드가 삭제되었습니다.');
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
    }
  };

  return (
    <>
      <Card>
        {/* Group Selection & Filter Bar */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack spacing={2}>
            <TextField
              select
              label="코드 그룹"
              fullWidth
              value={selectedGroupKey}
              onChange={(e) => setSelectedGroupKey(e.target.value)}
              disabled={groupsLoading || !groups || groups.length === 0}
            >
              {groups?.map((group) => (
                <MenuItem key={group.id} value={group.groupKey}>
                  {group.groupName} ({group.groupKey})
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="검색"
                size="small"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                sx={{ flex: 1 }}
                placeholder="코드 키, 코드명, 코드 값, 설명"
                disabled={!selectedGroupKey}
              />
              <TextField
                select
                label="스코프"
                size="small"
                value={tenantScope}
                onChange={(e) => setTenantScope(e.target.value as 'COMMON' | 'TENANT' | 'ALL')}
                sx={{ minWidth: 150 }}
                disabled={!selectedGroupKey}
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
                    disabled={!selectedGroupKey}
                  />
                }
                label="활성화만"
              />
              <PermissionGate resource="menu.admin.codes" permission="CREATE">
                <Button
                  variant="contained"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={handleCreateCode}
                  disabled={!selectedGroupKey}
                >
                  코드 추가
                </Button>
              </PermissionGate>
            </Stack>
          </Stack>
        </Box>

        {/* Table */}
        {codesError ? (
          <Box sx={{ p: 2 }}>
            <ApiErrorAlert error={codesError} />
          </Box>
        ) : !selectedGroupKey ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              코드 그룹을 선택하세요.
            </Typography>
          </Box>
        ) : codesLoading ? (
          <Box sx={{ p: 2 }}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : !filteredCodes || filteredCodes.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              데이터가 없습니다.
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>코드 키</TableCell>
                <TableCell>코드명</TableCell>
                <TableCell>코드 값</TableCell>
                <TableCell>스코프</TableCell>
                <TableCell>정렬 순서</TableCell>
                <TableCell>상태</TableCell>
                <TableCell align="right">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCodes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell>{code.codeKey}</TableCell>
                  <TableCell>{code.codeName}</TableCell>
                  <TableCell>{code.codeValue || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={code.tenantScope === 'COMMON' ? '공통' : '테넌트'}
                      color={code.tenantScope === 'COMMON' ? 'primary' : 'secondary'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{code.sortOrder ?? '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={code.enabled ? '활성' : '비활성'}
                      color={code.enabled ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={(e) => handleCodeMenuOpen(e, code)}>
                      <Iconify icon="solar:menu-dots-bold" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Code Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl) && Boolean(selectedCode)} onClose={handleMenuClose}>
        <PermissionGate resource="menu.admin.codes" permission="UPDATE">
          <MenuItem onClick={() => selectedCode && handleEditCode(selectedCode)}>
            <Iconify icon="solar:pen-bold" width={16} sx={{ mr: 1 }} />
            편집
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.codes" permission="DELETE">
          <MenuItem onClick={() => selectedCode && handleDeleteCode(selectedCode)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </PermissionGate>
      </Menu>

      {/* Code Dialog */}
      <CodeEditorModal
        open={codeDialogOpen}
        onClose={() => setCodeDialogOpen(false)}
        code={selectedCode}
        groupKey={selectedGroupKey}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      {selectedCode && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title="코드 삭제"
          content={`정말 "${selectedCode.codeName}" 코드를 삭제하시겠습니까?`}
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
