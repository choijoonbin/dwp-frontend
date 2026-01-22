// ----------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import { trackEvent, PermissionRouteGuard } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Drawer from '@mui/material/Drawer';
import Snackbar from '@mui/material/Snackbar';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

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
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      label: '권한 관리',
      metadata: {
        page: window.location.pathname,
      },
    });
  }, []);

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    refetch();
    showSnackbar('권한이 생성되었습니다.');
  };

  const handleDetailSuccess = () => {
    refetch();
    showSnackbar('변경사항이 저장되었습니다.');
  };

  const handleRoleSelect = useCallback(
    (roleId: string) => {
      setSelectedRoleId(roleId);
      if (isMobile) {
        setMobileDetailOpen(true);
      }
    },
    [isMobile, setSelectedRoleId]
  );

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
    <Box
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
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack spacing={1}>
            <Typography variant="h4">권한 관리</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              권한 및 권한 그룹을 관리합니다.
            </Typography>
          </Stack>
        </Stack>

        {/* Main Content: Left List + Right Detail */}
        <Grid container spacing={2} alignItems="stretch" sx={{ flex: 1, minHeight: 0 }}>
          {/* Left: Roles List Panel */}
          <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', minHeight: 0, height: 1 }}>
            <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <RoleListPanel
                roles={roleRowModels}
                selectedRoleId={selectedRoleId}
                onRoleSelect={handleRoleSelect}
                onCreateClick={() => setCreateModalOpen(true)}
                isLoading={isLoading}
                error={error}
              />
            </Card>
          </Grid>

          {/* Right: Role Detail Panel */}
          <Grid size={{ xs: 12, md: 8 }} sx={{ display: { xs: 'none', sm: 'flex' }, minHeight: 0, height: 1 }}>
            <Box sx={{ flex: 1, minHeight: 0, width: 1, display: 'flex' }}>
              <RoleDetailPanel
                roleId={selectedRoleId}
                onCreateClick={() => setCreateModalOpen(true)}
                onDelete={handleDeleteClick}
                onSuccess={handleDetailSuccess}
              />
            </Box>
          </Grid>
        </Grid>
      </Stack>

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          anchor="right"
          open={mobileDetailOpen && Boolean(selectedRoleId)}
          onClose={() => setMobileDetailOpen(false)}
          PaperProps={{
            sx: {
              width: '100%',
              maxWidth: 520,
            },
          }}
        >
          <RoleDetailPanel
            roleId={selectedRoleId}
            onCreateClick={() => setCreateModalOpen(true)}
            onDelete={handleDeleteClick}
            onSuccess={handleDetailSuccess}
            onClose={() => setMobileDetailOpen(false)}
          />
        </Drawer>
      )}

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
          title="권한 삭제"
          content={`정말 "${roleRowModels.find((r) => r.id === selectedRoleIdForDelete)?.roleName || ''}" 권한을 삭제하시겠습니까?`}
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
