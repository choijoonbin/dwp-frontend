import { useState, useMemo, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { PermissionGate } from '@dwp-frontend/design-system';
import { PermissionRouteGuard } from '@dwp-frontend/shared-utils';
import {
  useCodeGroupsQuery,
  useCodesByGroupQuery,
  useCreateCodeGroupMutation,
  useUpdateCodeGroupMutation,
  useDeleteCodeGroupMutation,
  useCreateCodeMutation,
  useUpdateCodeMutation,
  useDeleteCodeMutation,
  type CodeGroup,
  type Code,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import ListItem from '@mui/material/ListItem';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

export const CodesPage = () => (
  <PermissionRouteGuard resource="menu.admin.codes" permission="VIEW" redirectTo="/403">
    <CodesPageContent />
  </PermissionRouteGuard>
);

const CodesPageContent = () => {
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('');
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
  const [deleteCodeDialogOpen, setDeleteCodeDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CodeGroup | null>(null);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { data: groups, isLoading: groupsLoading, error: groupsError, refetch: refetchGroups } = useCodeGroupsQuery();
  const {
    data: codes,
    isLoading: codesLoading,
    error: codesError,
    refetch: refetchCodes,
  } = useCodesByGroupQuery(selectedGroupKey);

  const createGroupMutation = useCreateCodeGroupMutation();
  const updateGroupMutation = useUpdateCodeGroupMutation();
  const deleteGroupMutation = useDeleteCodeGroupMutation();
  const createCodeMutation = useCreateCodeMutation();
  const updateCodeMutation = useUpdateCodeMutation();
  const deleteCodeMutation = useDeleteCodeMutation();

  // Select first group by default
  useEffect(() => {
    if (groups && groups.length > 0 && !selectedGroupKey) {
      setSelectedGroupKey(groups[0].groupKey);
    }
  }, [groups, selectedGroupKey]);

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
    setDeleteGroupDialogOpen(true);
    setAnchorEl(null);
  };

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
    setDeleteCodeDialogOpen(true);
    setAnchorEl(null);
  };

  const handleGroupMenuOpen = (event: React.MouseEvent<HTMLElement>, group: CodeGroup) => {
    setAnchorEl(event.currentTarget);
    setSelectedGroup(group);
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

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4">코드 관리</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            시스템 코드 그룹 및 코드를 관리합니다.
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
          {/* Code Groups List */}
          <Card sx={{ width: { xs: '100%', lg: 300 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
              <Typography variant="h6">코드 그룹</Typography>
              <PermissionGate resource="menu.admin.codes" permission="CREATE">
                <IconButton size="small" onClick={handleCreateGroup}>
                  <Iconify icon="mingcute:add-line" />
                </IconButton>
              </PermissionGate>
            </Stack>
            {groupsLoading ? (
              <Box sx={{ p: 2 }}>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Skeleton key={idx} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
                ))}
              </Box>
            ) : groupsError ? (
              <Alert severity="error" sx={{ m: 2 }}>
                {groupsError instanceof Error ? groupsError.message : 'Unknown error'}
              </Alert>
            ) : !groups || groups.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  코드 그룹이 없습니다.
                </Typography>
              </Box>
            ) : (
              <List>
                {groups.map((group) => (
                  <ListItem
                    key={group.id}
                    disablePadding
                    secondaryAction={
                      <IconButton size="small" onClick={(e) => handleGroupMenuOpen(e, group)}>
                        <Iconify icon="solar:menu-dots-bold" />
                      </IconButton>
                    }
                  >
                    <ListItemButton
                      selected={selectedGroupKey === group.groupKey}
                      onClick={() => setSelectedGroupKey(group.groupKey)}
                    >
                      <ListItemText primary={group.groupName} secondary={group.groupKey} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Card>

          {/* Codes Table */}
          <Card sx={{ flex: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
              <Typography variant="h6">
                {groups?.find((g) => g.groupKey === selectedGroupKey)?.groupName || '코드 목록'}
              </Typography>
              <PermissionGate resource="menu.admin.codes" permission="CREATE">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={handleCreateCode}
                  disabled={!selectedGroupKey}
                >
                  코드 추가
                </Button>
              </PermissionGate>
            </Stack>
            {codesLoading ? (
              <Box sx={{ p: 2 }}>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Skeleton key={idx} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
                ))}
              </Box>
            ) : codesError ? (
              <Alert severity="error" sx={{ m: 2 }}>
                {codesError instanceof Error ? codesError.message : 'Unknown error'}
              </Alert>
            ) : !selectedGroupKey ? (
              <Box sx={{ p: 3 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  코드 그룹을 선택하세요.
                </Typography>
              </Box>
            ) : !codes || codes.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  코드가 없습니다.
                </Typography>
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>코드 키</TableCell>
                    <TableCell>코드명</TableCell>
                    <TableCell>코드 값</TableCell>
                    <TableCell>정렬 순서</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell align="right">작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {codes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>{code.codeKey}</TableCell>
                      <TableCell>{code.codeName}</TableCell>
                      <TableCell>{code.codeValue || '-'}</TableCell>
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
        </Stack>
      </Stack>

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

      {/* Group Dialog */}
      <CodeGroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        group={selectedGroup}
        onSuccess={() => {
          setGroupDialogOpen(false);
          refetchGroups();
          showSnackbar(selectedGroup ? '코드 그룹이 수정되었습니다.' : '코드 그룹이 생성되었습니다.');
        }}
      />

      {/* Code Dialog */}
      <CodeDialog
        open={codeDialogOpen}
        onClose={() => setCodeDialogOpen(false)}
        code={selectedCode}
        groupKey={selectedGroupKey}
        onSuccess={() => {
          setCodeDialogOpen(false);
          refetchCodes();
          showSnackbar(selectedCode ? '코드가 수정되었습니다.' : '코드가 생성되었습니다.');
        }}
      />

      {/* Delete Group Dialog */}
      {selectedGroup && (
        <DeleteConfirmDialog
          open={deleteGroupDialogOpen}
          onClose={() => setDeleteGroupDialogOpen(false)}
          title="코드 그룹 삭제"
          content={`정말 "${selectedGroup.groupName}" 코드 그룹을 삭제하시겠습니까?`}
          onConfirm={async () => {
            try {
              await deleteGroupMutation.mutateAsync(selectedGroup.id);
              setDeleteGroupDialogOpen(false);
              refetchGroups();
              if (selectedGroupKey === selectedGroup.groupKey) {
                setSelectedGroupKey('');
              }
              showSnackbar('코드 그룹이 삭제되었습니다.');
            } catch (error) {
              showSnackbar(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
            }
          }}
        />
      )}

      {/* Delete Code Dialog */}
      {selectedCode && (
        <DeleteConfirmDialog
          open={deleteCodeDialogOpen}
          onClose={() => setDeleteCodeDialogOpen(false)}
          title="코드 삭제"
          content={`정말 "${selectedCode.codeName}" 코드를 삭제하시겠습니까?`}
          onConfirm={async () => {
            try {
              await deleteCodeMutation.mutateAsync({
                codeId: selectedCode.id,
                groupKey: selectedCode.groupKey,
              });
              setDeleteCodeDialogOpen(false);
              refetchCodes();
              showSnackbar('코드가 삭제되었습니다.');
            } catch (error) {
              showSnackbar(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
            }
          }}
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
    </Box>
  );
};

// ----------------------------------------------------------------------
// Code Group Dialog
// ----------------------------------------------------------------------

type CodeGroupDialogProps = {
  open: boolean;
  onClose: () => void;
  group: CodeGroup | null;
  onSuccess: () => void;
};

const CodeGroupDialog = ({ open, onClose, group, onSuccess }: CodeGroupDialogProps) => {
  const [formData, setFormData] = useState({
    groupKey: '',
    groupName: '',
    description: '',
    enabled: true,
  });

  const createMutation = useCreateCodeGroupMutation();
  const updateMutation = useUpdateCodeGroupMutation();

  useEffect(() => {
    if (group) {
      setFormData({
        groupKey: group.groupKey,
        groupName: group.groupName,
        description: group.description || '',
        enabled: group.enabled,
      });
    } else {
      setFormData({
        groupKey: '',
        groupName: '',
        description: '',
        enabled: true,
      });
    }
  }, [group]);

  const handleSubmit = async () => {
    try {
      if (group) {
        await updateMutation.mutateAsync({
          groupId: group.id,
          payload: {
            groupKey: formData.groupKey,
            groupName: formData.groupName,
            description: formData.description || undefined,
            enabled: formData.enabled,
          },
        });
      } else {
        await createMutation.mutateAsync({
          groupKey: formData.groupKey,
          groupName: formData.groupName,
          description: formData.description || undefined,
          enabled: formData.enabled,
        });
      }
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{group ? '코드 그룹 편집' : '코드 그룹 추가'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="그룹 키 *"
            fullWidth
            value={formData.groupKey}
            onChange={(e) => setFormData({ ...formData, groupKey: e.target.value })}
            required
            disabled={!!group}
          />
          <TextField
            label="그룹명 *"
            fullWidth
            value={formData.groupName}
            onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
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
          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
            }
            label="활성화"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.groupKey || !formData.groupName || (createMutation.isPending || updateMutation.isPending)}
        >
          {group ? '저장' : '생성'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ----------------------------------------------------------------------
// Code Dialog
// ----------------------------------------------------------------------

type CodeDialogProps = {
  open: boolean;
  onClose: () => void;
  code: Code | null;
  groupKey: string;
  onSuccess: () => void;
};

const CodeDialog = ({ open, onClose, code, groupKey, onSuccess }: CodeDialogProps) => {
  const [formData, setFormData] = useState({
    codeKey: '',
    codeName: '',
    codeValue: '',
    description: '',
    sortOrder: '',
    enabled: true,
  });

  const createMutation = useCreateCodeMutation();
  const updateMutation = useUpdateCodeMutation();

  useEffect(() => {
    if (code) {
      setFormData({
        codeKey: code.codeKey,
        codeName: code.codeName,
        codeValue: code.codeValue || '',
        description: code.description || '',
        sortOrder: code.sortOrder?.toString() || '',
        enabled: code.enabled,
      });
    } else {
      setFormData({
        codeKey: '',
        codeName: '',
        codeValue: '',
        description: '',
        sortOrder: '',
        enabled: true,
      });
    }
  }, [code]);

  const handleSubmit = async () => {
    try {
      if (code) {
        await updateMutation.mutateAsync({
          codeId: code.id,
          payload: {
            codeKey: formData.codeKey,
            codeName: formData.codeName,
            codeValue: formData.codeValue || undefined,
            description: formData.description || undefined,
            sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
            enabled: formData.enabled,
          },
        });
      } else {
        await createMutation.mutateAsync({
          groupKey,
          codeKey: formData.codeKey,
          codeName: formData.codeName,
          codeValue: formData.codeValue || undefined,
          description: formData.description || undefined,
          sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
          enabled: formData.enabled,
        });
      }
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{code ? '코드 편집' : '코드 추가'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="코드 키 *"
            fullWidth
            value={formData.codeKey}
            onChange={(e) => setFormData({ ...formData, codeKey: e.target.value })}
            required
            disabled={!!code}
          />
          <TextField
            label="코드명 *"
            fullWidth
            value={formData.codeName}
            onChange={(e) => setFormData({ ...formData, codeName: e.target.value })}
            required
          />
          <TextField
            label="코드 값"
            fullWidth
            value={formData.codeValue}
            onChange={(e) => setFormData({ ...formData, codeValue: e.target.value })}
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
            label="정렬 순서"
            type="number"
            fullWidth
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
            }
            label="활성화"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.codeKey || !formData.codeName || (createMutation.isPending || updateMutation.isPending)}
        >
          {code ? '저장' : '생성'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ----------------------------------------------------------------------
// Delete Confirm Dialog
// ----------------------------------------------------------------------

type DeleteConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onConfirm: () => void;
};

const DeleteConfirmDialog = ({ open, onClose, title, content, onConfirm }: DeleteConfirmDialogProps) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <Typography variant="body2">{content}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>취소</Button>
      <Button variant="contained" color="error" onClick={onConfirm}>
        삭제
      </Button>
    </DialogActions>
  </Dialog>
);
