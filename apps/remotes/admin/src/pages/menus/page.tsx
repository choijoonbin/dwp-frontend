// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { useState, useEffect } from 'react';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';
import { trackEvent, PermissionRouteGuard } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { useMenuActions } from './hooks/use-menu-actions';
import { MenuTreePanel } from './components/menu-tree-panel';
import { MenuCreateModal } from './components/menu-create-modal';
import { MenuDetailEditor } from './components/menu-detail-editor';
import { useMenusTableState } from './hooks/use-menus-table-state';
import { useMenuEditorState } from './hooks/use-menu-editor-state';
import { DeleteConfirmDialog } from './components/delete-confirm-dialog';

// ----------------------------------------------------------------------

export const MenusPage = () => (
  <PermissionRouteGuard resource="menu.admin.menus" permission="VIEW" redirectTo="/403">
    <MenusPageContent />
  </PermissionRouteGuard>
);

const MenusPageContent = () => {
  const {
    menusTree,
    expandedNodes,
    isLoading,
    error,
    refetch,
    toggleNode,
  } = useMenusTableState();

  const {
    mode,
    open: editorOpen,
    draftForm,
    validationErrors,
    isCreateMode,
    selectedMenu,
    snackbar,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    updateFormField,
    validateForm,
    setSelectedMenu,
    showSnackbar,
    closeSnackbar,
  } = useMenuEditorState();

  const { createMenu, updateMenu, deleteMenu, reorderMenu, isCreating, isUpdating, isDeleting } = useMenuActions(
    showSnackbar,
    refetch
  );

  // Additional state for dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuToDelete, setMenuToDelete] = useState<AdminMenuNode | null>(null);

  // Track page view
  useEffect(() => {
    trackEvent({
      resourceKey: 'menu.admin.menus',
      action: 'VIEW',
      label: '메뉴 관리',
      metadata: {
        page: window.location.pathname,
      },
    });
  }, []);

  // Handle tree actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, menu: AdminMenuNode) => {
    setAnchorEl(event.currentTarget);
    setSelectedMenu(menu);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuSelect = (menu: AdminMenuNode) => {
    setSelectedMenu(menu);
    // Initialize form for detail editor (useMenuEditorState's useEffect will handle this)
    trackEvent({
      resourceKey: 'menu.admin.menus',
      action: 'SELECT',
      label: '메뉴 선택',
      metadata: {
        menuId: menu.id,
        menuName: menu.menuName,
      },
    });
  };

  const handleEdit = (menu: AdminMenuNode) => {
    trackEvent({
      resourceKey: 'btn.admin.menus.edit',
      action: 'CLICK',
      label: '메뉴 편집',
      metadata: {
        menuId: menu.id,
        menuName: menu.menuName,
      },
    });
    openEditDialog(menu);
    handleMenuClose();
  };

  const handleDelete = (menu: AdminMenuNode) => {
    trackEvent({
      resourceKey: 'btn.admin.menus.delete',
      action: 'CLICK',
      label: '메뉴 삭제',
      metadata: {
        menuId: menu.id,
        menuName: menu.menuName,
      },
    });
    setMenuToDelete(menu);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleReorder = (menuId: string, direction: 'UP' | 'DOWN') => {
    reorderMenu(menuId, direction);
  };

  // Handle form submit
  const handleFormSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    let success = false;
    if (isCreateMode) {
      success = await createMenu(draftForm);
    } else if (selectedMenu) {
      success = await updateMenu(selectedMenu.id, draftForm);
    }

    if (success) {
      closeDialog();
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!menuToDelete) return;
    const success = await deleteMenu(menuToDelete);
    if (success) {
      setDeleteDialogOpen(false);
      setMenuToDelete(null);
      setSelectedMenu(null);
    }
  };

  // Handle detail editor save
  const handleDetailSave = async () => {
    if (!validateForm() || !selectedMenu) {
      return;
    }
    const success = await updateMenu(selectedMenu.id, draftForm);
    if (success) {
      // Keep editor open, just refresh
      refetch();
    }
  };

  // Handle detail editor delete
  const handleDetailDelete = () => {
    if (selectedMenu) {
      handleDelete(selectedMenu);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack spacing={1}>
            <Typography variant="h4">메뉴 관리</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              메뉴 트리 및 메뉴 정보를 관리합니다.
            </Typography>
          </Stack>
          <PermissionGate resource="menu.admin.menus" permission="CREATE">
            <IconButton onClick={openCreateDialog} color="primary" sx={{ width: 48, height: 48 }}>
              <Iconify icon="mingcute:add-line" width={24} />
            </IconButton>
          </PermissionGate>
        </Stack>

        {/* Main Content: Left Tree + Right Detail */}
        <Grid container spacing={2}>
          {/* Left: Menu Tree */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <MenuTreePanel
                tree={menusTree}
                expandedNodes={expandedNodes}
                isLoading={isLoading}
                error={error}
                anchorEl={anchorEl}
                selectedMenu={selectedMenu}
                onToggleNode={toggleNode}
                onMenuOpen={handleMenuOpen}
                onMenuClose={handleMenuClose}
                onMenuSelect={handleMenuSelect}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            </Card>
          </Grid>

          {/* Right: Menu Detail Editor */}
          <Grid size={{ xs: 12, md: 8 }}>
            <MenuDetailEditor
              menu={selectedMenu}
              menusTree={menusTree}
              formData={draftForm}
              validationErrors={validationErrors}
              isLoading={isUpdating || isDeleting}
              onFormChange={updateFormField}
              onSave={handleDetailSave}
              onDelete={handleDetailDelete}
            />
          </Grid>
        </Grid>
      </Stack>

      {/* Create Modal */}
      <MenuCreateModal
        open={isCreateMode && editorOpen}
        menusTree={menusTree}
        formData={draftForm}
        validationErrors={validationErrors}
        isLoading={isCreating}
        onClose={closeDialog}
        onFormChange={updateFormField}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Dialog */}
      {menuToDelete && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setMenuToDelete(null);
          }}
          title="메뉴 삭제"
          content={`정말 "${menuToDelete.menuName}" 메뉴를 삭제하시겠습니까?`}
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
