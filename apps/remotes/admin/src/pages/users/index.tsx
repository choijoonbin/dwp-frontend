// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';
import { trackEvent, type UserSummary, PermissionRouteGuard } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';

import { UsersTable } from './components/users-table';
import { useUserActions } from './hooks/use-user-actions';
import { UsersFilters } from './components/users-filters';
import { UserRoleAssign } from './components/user-role-assign';
import { UserEditorModal } from './components/user-editor-modal';
import { useUsersTableState } from './hooks/use-users-table-state';
import { useUserEditorState } from './hooks/use-user-editor-state';
import { UserDetailDrawer } from './components/user-detail-drawer';
import { DeleteConfirmDialog } from './components/delete-confirm-dialog';
import { ResetPasswordDialog } from './components/reset-password-dialog';

// ----------------------------------------------------------------------

export const UsersPage = () => (
  <PermissionRouteGuard resource="menu.admin.users" permission="VIEW" redirectTo="/403">
    <UsersPageContent />
  </PermissionRouteGuard>
);

const UsersPageContent = () => {
  const { t } = useTranslation('admin');
  const {
    keyword,
    statusFilter,
    loginTypeFilter,
    departmentFilter,
    page,
    rowsPerPage,
    selectedUserId,
    setKeyword,
    setStatusFilter,
    setLoginTypeFilter,
    setDepartmentFilter,
    setPage,
    setRowsPerPage,
    setSelectedUserId,
    userRowModels,
    usersData,
    isLoading,
    error,
    refetch,
  } = useUsersTableState();

  const {
    open: editorOpen,
    draftForm,
    validationErrors,
    isCreateMode,
    isEditMode,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    updateFormField,
    validateForm,
    selectedUser,
    snackbar,
    showSnackbar,
    closeSnackbar,
  } = useUserEditorState();

  const { createUser, updateUser, deleteUser, updateUserRoles, isCreating, isUpdating, isUpdatingRoles } =
    useUserActions(showSnackbar, refetch);

  // Additional state for dialogs
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Track page view
  useEffect(() => {
    trackEvent({
      resourceKey: 'menu.admin.users',
      action: 'VIEW',
      label: '사용자 관리',
      metadata: {
        page: window.location.pathname,
      },
    });
  }, []);

  // Track search
  useEffect(() => {
    if (keyword || statusFilter || loginTypeFilter) {
      trackEvent({
        resourceKey: 'menu.admin.users',
        action: 'SEARCH',
        label: '사용자 검색',
        metadata: {
          keyword,
          status: statusFilter,
          loginType: loginTypeFilter,
        },
      });
    }
  }, [keyword, statusFilter, loginTypeFilter]);

  // Handle table actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: typeof userRowModels[0]) => {
    setAnchorEl(event.currentTarget);
    setSelectedUserId(user.id);
  };

  const handleMenuClose = () => {
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl) activeEl.blur();
    setAnchorEl(null);
  };

  const handleEdit = (user: typeof userRowModels[0]) => {
    trackEvent({
      resourceKey: 'btn.admin.users.edit',
      action: 'CLICK',
      label: '사용자 편집',
      metadata: {
        userId: user.id,
        userName: user.userName,
      },
    });
    // Convert UserRowModel to UserSummary for openEditDialog
    const userSummary: UserSummary = {
      id: user.id,
      userName: user.userName,
      email: user.email,
      departmentName: user.departmentName,
      departmentId: null,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
    openEditDialog(userSummary);
    handleMenuClose();
  };

  const handleDelete = (user: typeof userRowModels[0]) => {
    trackEvent({
      resourceKey: 'btn.admin.users.delete',
      action: 'CLICK',
      label: '사용자 삭제',
      metadata: {
        userId: user.id,
        userName: user.userName,
      },
    });
    setSelectedUserId(user.id);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleRoles = (user: typeof userRowModels[0]) => {
    setSelectedUserId(user.id);
    setRolesDialogOpen(true);
    handleMenuClose();
  };

  const handleRowClick = (user: typeof userRowModels[0]) => {
    setSelectedUserId(user.id);
    setDetailDrawerOpen(true);
  };

  const handleResetPassword = (user: typeof userRowModels[0]) => {
    setSelectedUserId(user.id);
    setResetPasswordDialogOpen(true);
    handleMenuClose();
  };

  // Handle form submit
  const handleFormSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    let success = false;
    if (isCreateMode) {
      success = await createUser(draftForm);
    } else if (isEditMode && selectedUser) {
      success = await updateUser(selectedUser.id, draftForm);
    }

    if (success) {
      closeDialog(true);
    }
  };

  // Handle role assignment
  const handleRoleSubmit = async (roleIds: string[], replace: boolean) => {
    if (!selectedUserId) return false;
    return await updateUserRoles(selectedUserId, roleIds, replace);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!selectedUserId) return;
    const user = userRowModels.find((u) => u.id === selectedUserId);
    if (!user) return;
    const userSummary: UserSummary = {
      id: user.id,
      userName: user.userName,
      email: user.email,
      departmentName: user.departmentName,
      departmentId: null,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
    const success = await deleteUser(userSummary);
    if (success) {
      setDeleteDialogOpen(false);
      setSelectedUserId(null);
    }
  };

  const selectedUserForDelete = userRowModels.find((u) => u.id === selectedUserId);
  const selectedUserForReset = userRowModels.find((u) => u.id === selectedUserId);

  return (
    <Box
      data-testid="page-admin-users"
      sx={{
        p: 3,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack spacing={3} sx={{ flex: 1, minHeight: 0 }}>
        {/* Header: 타이틀과 동일 행 우측에 사용자 추가 버튼 (참고: roles/page.tsx, role-list-panel) */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack spacing={1}>
            <Typography variant="h4">사용자 관리</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              시스템 사용자 목록 및 권한을 관리합니다.
            </Typography>
          </Stack>
          <PermissionGate resource="menu.admin.users" permission="EDIT">
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={openCreateDialog}
              sx={{ minHeight: 40 }}
            >
              사용자 추가
            </Button>
          </PermissionGate>
        </Stack>

        {/* Filter Bar */}
        <UsersFilters
          keyword={keyword}
          statusFilter={statusFilter}
          loginTypeFilter={loginTypeFilter}
          departmentFilter={departmentFilter}
          onKeywordChange={setKeyword}
          onStatusFilterChange={setStatusFilter}
          onLoginTypeFilterChange={setLoginTypeFilter}
          onDepartmentFilterChange={setDepartmentFilter}
        />

        {/* Table */}
        <UsersTable
          users={userRowModels}
          page={page}
          rowsPerPage={rowsPerPage}
          total={usersData?.total || 0}
          isLoading={isLoading}
          error={error}
          selectedUserId={selectedUserId}
          anchorEl={anchorEl}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
          onMenuOpen={handleMenuOpen}
          onMenuClose={handleMenuClose}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRoles={handleRoles}
          onResetPassword={handleResetPassword}
          onRowClick={handleRowClick}
          onRetry={refetch}
        />
      </Stack>

      {/* Create/Edit Modal */}
      <UserEditorModal
        open={editorOpen}
        mode={isCreateMode ? 'create' : 'edit'}
        formData={draftForm}
        validationErrors={validationErrors}
        isLoading={isCreating || isUpdating}
        onClose={() => closeDialog(false)}
        onCancel={() => closeDialog(true)}
        onFormChange={updateFormField}
        onSubmit={handleFormSubmit}
      />

      {/* Detail Drawer: 클릭 시 GET /api/admin/users/:userId, GET /api/admin/users/:userId/roles 호출. 목록 행 데이터는 로딩/실패 시 표시용으로 전달 */}
      <UserDetailDrawer
        open={detailDrawerOpen}
        userId={selectedUserId}
        selectedUserRow={selectedUserId ? userRowModels.find((u) => u.id === selectedUserId) ?? null : null}
        onClose={() => setDetailDrawerOpen(false)}
      />

      {/* Roles Dialog: 항상 마운트하고 open/userId로 제어 (메뉴 클릭 직후에도 팝업 표시 보장) */}
      <UserRoleAssign
        open={rolesDialogOpen}
        userId={selectedUserId ?? ''}
        isLoading={isUpdatingRoles}
        onClose={() => setRolesDialogOpen(false)}
        onSubmit={handleRoleSubmit}
      />

      {/* Reset Password Dialog */}
      {selectedUserForReset && (
        <ResetPasswordDialog
          open={resetPasswordDialogOpen}
          onClose={() => setResetPasswordDialogOpen(false)}
          userId={selectedUserForReset.id}
          userName={selectedUserForReset.userName}
          onSuccess={(temporaryPassword) => {
            setResetPasswordDialogOpen(false);
            showSnackbar(
              temporaryPassword ? t('toast.passwordResetWithTemp', { password: temporaryPassword }) : t('toast.passwordReset')
            );
          }}
        />
      )}

      {/* Delete Dialog */}
      {selectedUserForDelete && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title={t('confirm.deleteUser')}
          content={t('confirm.deleteUserContent', { userName: selectedUserForDelete.userName })}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
