// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';
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
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useMenuActions } from './hooks/use-menu-actions';
import { MenuTreePanel } from './components/menu-tree-panel';
import { MenuCreateModal } from './components/menu-create-modal';
import { MenuDetailEditor } from './components/menu-detail-editor';
import { useMenusTableState } from './hooks/use-menus-table-state';
import { useMenuEditorState } from './hooks/use-menu-editor-state';
import { DeleteConfirmDialog } from './components/delete-confirm-dialog';
import { getMenuSiblings, findMenuNodeById } from './adapters/menu-adapter';

import type { MenuFormState } from './types';

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
    open: editorOpen,
    draftForm,
    validationErrors,
    isCreateMode,
    selectedMenu,
    resetForm,
    snackbar,
    openCreateDialog,
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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Additional state for dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuToDelete, setMenuToDelete] = useState<AdminMenuNode | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDisabled, setShowDisabled] = useState(true);
  const [actionMeta, setActionMeta] = useState<{ isFirst: boolean; isLast: boolean } | null>(null);

  const createParent = useMemo(() => (
    draftForm.parentId ? findMenuNodeById(menusTree, draftForm.parentId) : null
  ), [draftForm.parentId, menusTree]);

  const mapMenuToForm = useCallback((menu: AdminMenuNode): MenuFormState => ({
    menuKey: menu.menuKey || '',
    menuName: menu.menuName || '',
    path: menu.path || '',
    icon: menu.icon || '',
    group: menu.group || '',
    parentId: menu.parentId || '',
    sortOrder: menu.sortOrder?.toString() || '',
    enabled: menu.enabled ?? true,
  }), []);

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
    const siblings = getMenuSiblings(menusTree, menu.id);
    const index = siblings.findIndex((item) => item.id === menu.id);
    setActionMeta({
      isFirst: index <= 0,
      isLast: index === siblings.length - 1,
    });
    setAnchorEl(event.currentTarget);
    setSelectedMenu(menu);
  };

  const handleMenuClose = () => {
    setActionMeta(null);
    setAnchorEl(null);
  };

  const handleMenuSelect = (menu: AdminMenuNode) => {
    setSelectedMenu(menu);
    if (isMobile) {
      setMobileDetailOpen(true);
    }
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

  const handleCreateChild = (menu: AdminMenuNode) => {
    openCreateDialog(menu.id);
    handleMenuClose();
  };


  const handleToggleEnabled = async (menu: AdminMenuNode) => {
    const formData = mapMenuToForm(menu);
    formData.enabled = !(menu.enabled ?? true);
    await updateMenu(menu.id, formData);
    handleMenuClose();
  };

  const handleCopyKey = async (menuKey: string) => {
    try {
      await navigator.clipboard.writeText(menuKey);
      showSnackbar('메뉴 키가 복사되었습니다.');
    } catch {
      showSnackbar('메뉴 키 복사에 실패했습니다.', 'error');
    }
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

  const handleReorder = async (menuId: string, direction: 'UP' | 'DOWN') => {
    await reorderMenu(menuId, direction);
    handleMenuClose();
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
      setMobileDetailOpen(false);
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

  const handleOpenCreateRoot = () => {
    openCreateDialog();
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
            <IconButton onClick={handleOpenCreateRoot} color="primary" sx={{ width: 48, height: 48 }}>
              <Iconify icon="mingcute:add-line" width={24} />
            </IconButton>
          </PermissionGate>
        </Stack>

        {/* Main Content: Left Tree + Right Detail */}
        <Grid container spacing={2} alignItems="stretch">
          {/* Left: Menu Tree */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <MenuTreePanel
                tree={menusTree}
                expandedNodes={expandedNodes}
                isLoading={isLoading}
                error={error}
                anchorEl={anchorEl}
                actionMeta={actionMeta}
                selectedMenu={selectedMenu}
                showDisabled={showDisabled}
                searchQuery={searchQuery}
                onToggleNode={toggleNode}
                onMenuOpen={handleMenuOpen}
                onMenuClose={handleMenuClose}
                onMenuSelect={handleMenuSelect}
                onCreateChild={handleCreateChild}
                onToggleEnabled={handleToggleEnabled}
                onCopyKey={handleCopyKey}
                onDelete={handleDelete}
                onReorder={handleReorder}
                onShowDisabledChange={setShowDisabled}
                onSearchChange={setSearchQuery}
              />
            </Card>
          </Grid>

          {/* Right: Menu Detail Editor */}
          <Grid size={{ xs: 12, md: 8 }} sx={{ display: { xs: 'none', sm: 'block' } }}>
            <MenuDetailEditor
              menu={selectedMenu}
              menusTree={menusTree}
              formData={draftForm}
              validationErrors={validationErrors}
              isLoading={isUpdating || isDeleting}
              onFormChange={updateFormField}
              onReset={resetForm}
              onCreateChild={handleCreateChild}
              onSave={handleDetailSave}
              onDelete={handleDetailDelete}
            />
          </Grid>
        </Grid>
      </Stack>

      {/* Create Modal */}
      <MenuCreateModal
        open={isCreateMode && editorOpen}
        parentMenu={createParent}
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

      <Drawer
        anchor="right"
        open={mobileDetailOpen && isMobile}
        onClose={() => setMobileDetailOpen(false)}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 520,
          },
        }}
      >
        <Box sx={{ height: '100%' }}>
          <MenuDetailEditor
            menu={selectedMenu}
            menusTree={menusTree}
            formData={draftForm}
            validationErrors={validationErrors}
            isLoading={isUpdating || isDeleting}
            onFormChange={updateFormField}
            onReset={resetForm}
            onCreateChild={handleCreateChild}
            onSave={handleDetailSave}
            onDelete={handleDetailDelete}
            onClose={() => setMobileDetailOpen(false)}
            variant="drawer"
          />
        </Box>
      </Drawer>
    </Box>
  );
};
