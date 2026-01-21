// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { trackEvent, PermissionRouteGuard } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';

import { useRoleActions } from './hooks/use-role-actions';
import { RoleListPanel } from './components/role-list-panel';
import { RoleDetailPanel } from './components/role-detail-panel';
import { CreateRoleModal } from './components/create-role-modal';
import { useRoleTableState } from './hooks/use-role-table-state';
import { DeleteConfirmDialog } from './components/delete-confirm-dialog';

// ----------------------------------------------------------------------

export const RolesPage = () => (
  <PermissionRouteGuard resource="menu.admin.roles" permission="VIEW" redirectTo="/403">
    <RolesPageContent />
  </PermissionRouteGuard>
);

const RolesPageContent = () => {
  const {
    selectedRoleId,
    setSelectedRoleId,
    roleRowModels,
    isLoading,
    error,
    refetch,
  } = useRoleTableState();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRoleIdForDelete, setSelectedRoleIdForDelete] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const { deleteRole } = useRoleActions(
    () => setCreateModalOpen(true),
    () => {}, // Edit handled in RoleDetailPanel
    setDeleteDialogOpen,
    () => {}, // setSelectedRole not needed
    showSnackbar,
    refetch,
    setSelectedRoleId
  );

  // Track page view
  useEffect(() => {
    trackEvent({
      resourceKey: 'menu.admin.roles',
      action: 'VIEW',
      label: '권한 그룹 관리',
      metadata: {
        page: window.location.pathname,
      },
    });
  }, []);

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    refetch();
    showSnackbar('역할이 생성되었습니다.');
  };

  const handleDetailSuccess = () => {
    refetch();
    showSnackbar('변경사항이 저장되었습니다.');
  };

  const handleEdit = (roleId: string) => {
    // Edit is handled in RoleDetailPanel via RoleOverviewTab
    // This is a placeholder for future edit modal if needed
  };

  const handleDeleteClick = (roleId: string) => {
    setSelectedRoleIdForDelete(roleId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRoleIdForDelete) return;
    const role = roleRowModels.find((r) => r.id === selectedRoleIdForDelete);
    if (!role) return;

    const success = await deleteRole(
      {
        id: role.id,
        roleName: role.roleName,
        roleCode: role.roleCode,
        createdAt: role.createdAt,
        status: role.status,
      },
      selectedRoleId
    );

    if (success) {
      setDeleteDialogOpen(false);
      setSelectedRoleIdForDelete(null);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, py: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              권한 그룹 관리
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              역할(Role) 및 권한 그룹을 관리합니다.
            </Typography>
          </Stack>
        </Stack>
      </Box>

      {/* Main Content: Left List + Right Detail */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Roles List Panel */}
        <Box sx={{ width: 320, borderRight: 1, borderColor: 'divider', overflow: 'hidden' }}>
          <RoleListPanel
            roles={roleRowModels}
            selectedRoleId={selectedRoleId}
            onRoleSelect={setSelectedRoleId}
            onCreateClick={() => setCreateModalOpen(true)}
            isLoading={isLoading}
            error={error}
          />
        </Box>

        {/* Right: Role Detail Panel */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <RoleDetailPanel
            roleId={selectedRoleId}
            onCreateClick={() => setCreateModalOpen(true)}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onSuccess={handleDetailSuccess}
          />
        </Box>
      </Box>

      {/* Create Modal */}
      <CreateRoleModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onSuccess={handleCreateSuccess} />

      {/* Delete Dialog */}
      {selectedRoleIdForDelete && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setSelectedRoleIdForDelete(null);
          }}
          title="역할 삭제"
          content={`정말 "${roleRowModels.find((r) => r.id === selectedRoleIdForDelete)?.roleName || ''}" 역할을 삭제하시겠습니까?`}
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
