import { useState, useMemo, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { PermissionGate } from '@dwp-frontend/design-system';
import {
  PermissionRouteGuard,
  validateEmail,
  getEmailError,
  validatePassword,
  getPasswordError,
  useCodesByResourceQuery,
  getSelectOptionsByGroup,
} from '@dwp-frontend/shared-utils';
import {
  useAdminUsersQuery,
  useCreateAdminUserMutation,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useResetAdminUserPasswordMutation,
  useAdminUserRolesQuery,
  useUpdateAdminUserRolesMutation,
  useAdminRolesQuery,
  type UserSummary,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Menu from '@mui/material/Menu';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Checkbox from '@mui/material/Checkbox';
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
import TablePagination from '@mui/material/TablePagination';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------

export const UsersPage = () => (
  <PermissionRouteGuard resource="menu.admin.users" permission="VIEW" redirectTo="/403">
    <UsersPageContent />
  </PermissionRouteGuard>
);

const UsersPageContent = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Get codes by resource key
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.users');
  const userStatusOptions = getSelectOptionsByGroup(codeMap, 'USER_STATUS');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const params = useMemo(
    () => ({
      page: page + 1,
      size: rowsPerPage,
      keyword: keyword || undefined,
      status: (statusFilter as 'ACTIVE' | 'INACTIVE' | undefined) || undefined,
    }),
    [page, rowsPerPage, keyword, statusFilter]
  );

  const { data, isLoading, error, refetch } = useAdminUsersQuery(params);
  const createMutation = useCreateAdminUserMutation();
  const updateMutation = useUpdateAdminUserMutation();
  const deleteMutation = useDeleteAdminUserMutation();
  const resetPasswordMutation = useResetAdminUserPasswordMutation();

  const handleCreate = () => {
    setSelectedUser(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (user: UserSummary) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDelete = (user: UserSummary) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleRoles = (user: UserSummary) => {
    setSelectedUser(user);
    setRolesDialogOpen(true);
    setAnchorEl(null);
  };

  const handleResetPassword = (user: UserSummary) => {
    setSelectedUser(user);
    setResetPasswordDialogOpen(true);
    setAnchorEl(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: UserSummary) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
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
          <Typography variant="h4">사용자 관리</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            시스템 사용자 목록 및 권한을 관리합니다.
          </Typography>
        </Stack>

        {/* Filter Bar */}
        <Card sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="검색 (이름/이메일)"
              size="small"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(0);
              }}
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="상태"
              size="small"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              disabled={codesLoading || userStatusOptions.length === 0}
              helperText={codesLoading ? '코드 로딩 중...' : userStatusOptions.length === 0 ? '코드 매핑 필요' : undefined}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">전체</MenuItem>
              {userStatusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <PermissionGate resource="menu.admin.users" permission="CREATE">
              <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleCreate}>
                사용자 추가
              </Button>
            </PermissionGate>
          </Stack>
        </Card>

        {/* Table */}
        <Card>
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              데이터를 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : 'Unknown error'}
            </Alert>
          )}

          <Table>
            <TableHead>
              <TableRow>
                <TableCell>사용자명</TableCell>
                <TableCell>이메일</TableCell>
                <TableCell>부서</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>생성일</TableCell>
                <TableCell align="right">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: rowsPerPage }).map((_, idx) => (
                  <TableRow key={idx}>
                    {Array.from({ length: 6 }).map((_unused, cellIdx) => (
                      <TableCell key={cellIdx}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data || data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                      데이터가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.userName}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.departmentName || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.status === 'ACTIVE' ? '활성' : '비활성'}
                        color={user.status === 'ACTIVE' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, user)}>
                        <Iconify icon="solar:menu-dots-bold" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {data && (
            <TablePagination
              component="div"
              count={data.total}
              page={page}
              onPageChange={(_e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 30, 50]}
              labelRowsPerPage="페이지당 행 수:"
            />
          )}
        </Card>
      </Stack>

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <PermissionGate resource="menu.admin.users" permission="UPDATE">
          <MenuItem onClick={() => selectedUser && handleEdit(selectedUser)}>
            <Iconify icon="solar:pen-bold" width={16} sx={{ mr: 1 }} />
            편집
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.users" permission="MANAGE">
          <MenuItem onClick={() => selectedUser && handleRoles(selectedUser)}>
            <Iconify icon="solar:users-group-rounded-bold" width={16} sx={{ mr: 1 }} />
            역할 관리
          </MenuItem>
          <MenuItem onClick={() => selectedUser && handleResetPassword(selectedUser)}>
            <Iconify icon="solar:lock-password-bold" width={16} sx={{ mr: 1 }} />
            비밀번호 초기화
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.users" permission="DELETE">
          <MenuItem onClick={() => selectedUser && handleDelete(selectedUser)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </PermissionGate>
      </Menu>

      {/* Create Dialog */}
      <UserCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          setCreateDialogOpen(false);
          refetch();
          showSnackbar('사용자가 생성되었습니다.');
        }}
      />

      {/* Edit Dialog */}
      {selectedUser && (
        <UserEditDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          user={selectedUser}
          onSuccess={() => {
            setEditDialogOpen(false);
            refetch();
            showSnackbar('사용자가 수정되었습니다.');
          }}
        />
      )}

      {/* Roles Dialog */}
      {selectedUser && (
        <UserRolesDialog
          open={rolesDialogOpen}
          onClose={() => setRolesDialogOpen(false)}
          userId={selectedUser.id}
          onSuccess={() => {
            setRolesDialogOpen(false);
            showSnackbar('역할이 할당되었습니다.');
          }}
        />
      )}

      {/* Reset Password Dialog */}
      {selectedUser && (
        <ResetPasswordDialog
          open={resetPasswordDialogOpen}
          onClose={() => setResetPasswordDialogOpen(false)}
          userId={selectedUser.id}
          userName={selectedUser.userName}
          onSuccess={(temporaryPassword) => {
            setResetPasswordDialogOpen(false);
            showSnackbar(
              temporaryPassword ? `비밀번호가 초기화되었습니다. 임시 비밀번호: ${temporaryPassword}` : '비밀번호가 초기화되었습니다.'
            );
          }}
        />
      )}

      {/* Delete Dialog */}
      {selectedUser && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title="사용자 삭제"
          content={`정말 "${selectedUser.userName}" 사용자를 삭제하시겠습니까?`}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(selectedUser.id);
              setDeleteDialogOpen(false);
              refetch();
              showSnackbar('사용자가 삭제되었습니다.');
            } catch (deleteError) {
              showSnackbar(deleteError instanceof Error ? deleteError.message : '삭제에 실패했습니다.', 'error');
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
// User Create Dialog
// ----------------------------------------------------------------------

type UserCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const UserCreateDialog = ({ open, onClose, onSuccess }: UserCreateDialogProps) => {
  const [formData, setFormData] = useState({
    userName: '',
    email: '',
    departmentId: '',
    createLocalAccount: false,
    principal: '',
    password: '',
  });

  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const createMutation = useCreateAdminUserMutation();

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (formData.email) {
      const emailError = getEmailError(formData.email);
      if (emailError) newErrors.email = emailError;
    }

    if (formData.createLocalAccount && formData.password) {
      const passwordError = getPasswordError(formData.password);
      if (passwordError) newErrors.password = passwordError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await createMutation.mutateAsync({
        userName: formData.userName,
        email: formData.email || undefined,
        departmentId: formData.departmentId || undefined,
        createLocalAccount: formData.createLocalAccount,
        principal: formData.createLocalAccount ? formData.principal || undefined : undefined,
        password: formData.createLocalAccount ? formData.password || undefined : undefined,
      });
      onSuccess();
      setFormData({
        userName: '',
        email: '',
        departmentId: '',
        createLocalAccount: false,
        principal: '',
        password: '',
      });
      setErrors({});
    } catch (error) {
      // Error will be shown via Snackbar in parent component
      console.error('Failed to create user:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>사용자 추가</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="사용자명 *"
            fullWidth
            value={formData.userName}
            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
            required
          />
          <TextField
            label="이메일"
            type="email"
            fullWidth
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.createLocalAccount}
                onChange={(e) => setFormData({ ...formData, createLocalAccount: e.target.checked })}
              />
            }
            label="로컬 계정 생성"
          />
          {formData.createLocalAccount && (
            <>
              <TextField
                label="Principal"
                fullWidth
                value={formData.principal}
                onChange={(e) => setFormData({ ...formData, principal: e.target.value })}
              />
              <TextField
                label="비밀번호"
                type="password"
                fullWidth
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (errors.password) {
                    setErrors({ ...errors, password: undefined });
                  }
                }}
                error={!!errors.password}
                helperText={errors.password}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!formData.userName || createMutation.isPending}>
          생성
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ----------------------------------------------------------------------
// User Edit Dialog
// ----------------------------------------------------------------------

type UserEditDialogProps = {
  open: boolean;
  onClose: () => void;
  user: UserSummary;
  onSuccess: () => void;
};

const UserEditDialog = ({ open, onClose, user, onSuccess }: UserEditDialogProps) => {
  const [formData, setFormData] = useState({
    userName: user.userName,
    email: user.email || '',
    status: user.status,
  });

  const [errors, setErrors] = useState<{
    email?: string;
  }>({});

  const updateMutation = useUpdateAdminUserMutation();

  const validateForm = (): boolean => {
    const newErrors: { email?: string } = {};

    if (formData.email) {
      const emailError = getEmailError(formData.email);
      if (emailError) newErrors.email = emailError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await updateMutation.mutateAsync({
        userId: user.id,
        payload: {
          userName: formData.userName,
          email: formData.email || undefined,
          status: formData.status,
        },
      });
      onSuccess();
    } catch (error) {
      // Error will be shown via Snackbar in parent component
      console.error('Failed to update user:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>사용자 편집</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="사용자명 *"
            fullWidth
            value={formData.userName}
            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
            required
          />
          <TextField
            label="이메일"
            type="email"
            fullWidth
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (errors.email) {
                setErrors({ ...errors, email: undefined });
              }
            }}
            error={!!errors.email}
            helperText={errors.email}
          />
          <TextField
            select
            label="상태"
            fullWidth
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
          >
            <MenuItem value="ACTIVE">활성</MenuItem>
            <MenuItem value="INACTIVE">비활성</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!formData.userName || updateMutation.isPending}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ----------------------------------------------------------------------
// User Roles Dialog
// ----------------------------------------------------------------------

type UserRolesDialogProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
};

const UserRolesDialog = ({ open, onClose, userId, onSuccess }: UserRolesDialogProps) => {
  const { data: userRoles } = useAdminUserRolesQuery(userId);
  const { data: allRoles } = useAdminRolesQuery({ size: 1000 });
  const updateMutation = useUpdateAdminUserRolesMutation();

  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());

  // Initialize selected roles from userRoles
  useEffect(() => {
    if (userRoles) {
      setSelectedRoleIds(new Set(userRoles.map((r) => r.id)));
    }
  }, [userRoles]);

  const handleToggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      await updateMutation.mutateAsync({
        userId,
        roleIds: Array.from(selectedRoleIds),
      });
      onSuccess();
    } catch (error) {
      // Error will be shown via Snackbar in parent component
      console.error('Failed to update user roles:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>역할 할당</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {allRoles?.items.map((role) => (
            <FormControlLabel
              key={role.id}
              control={
                <Checkbox
                  checked={selectedRoleIds.has(role.id)}
                  onChange={() => handleToggleRole(role.id)}
                />
              }
              label={role.roleName}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={updateMutation.isPending}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ----------------------------------------------------------------------
// Reset Password Dialog
// ----------------------------------------------------------------------

type ResetPasswordDialogProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onSuccess: (temporaryPassword?: string) => void;
};

const ResetPasswordDialog = ({ open, onClose, userId, userName, onSuccess }: ResetPasswordDialogProps) => {
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
