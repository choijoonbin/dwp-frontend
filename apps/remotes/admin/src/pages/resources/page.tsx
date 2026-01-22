// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { trackEvent, type ResourceNode, PermissionRouteGuard } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';

import { ResourcesTree } from './components/resources-tree';
import { useResourceActions } from './hooks/use-resource-actions';
import { ResourcesFilters } from './components/resources-filters';
import { ResourceEditorModal } from './components/resource-editor-modal';
import { DeleteConfirmDialog } from './components/delete-confirm-dialog';
import { useResourcesTableState } from './hooks/use-resources-table-state';
import { useResourceEditorState } from './hooks/use-resource-editor-state';

// ----------------------------------------------------------------------

export const ResourcesPage = () => (
  <PermissionRouteGuard resource="menu.admin.resources" permission="VIEW" redirectTo="/403">
    <ResourcesPageContent />
  </PermissionRouteGuard>
);

const ResourcesPageContent = () => {
  const {
    keyword,
    resourceTypeFilter,
    expandedNodes,
    setKeyword,
    setResourceTypeFilter,
    toggleNode,
    filteredTree,
    resourcesTree,
    isLoading,
    error,
    refetch,
  } = useResourcesTableState();

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
    selectedResource,
    setSelectedResource,
    snackbar,
    showSnackbar,
    closeSnackbar,
  } = useResourceEditorState();

  const { createResource, updateResource, deleteResource, isCreating, isUpdating } = useResourceActions(showSnackbar, refetch);

  // Additional state for dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Track page view
  useEffect(() => {
    trackEvent({
      resourceKey: 'menu.admin.resources',
      action: 'VIEW',
      label: '리소스 관리',
      metadata: {
        page: window.location.pathname,
      },
    });
  }, []);

  // Track search
  useEffect(() => {
    if (keyword || resourceTypeFilter) {
      trackEvent({
        resourceKey: 'menu.admin.resources',
        action: 'SEARCH',
        label: '리소스 검색',
        metadata: {
          keyword,
          resourceType: resourceTypeFilter,
        },
      });
    }
  }, [keyword, resourceTypeFilter]);

  // Handle tree actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, resource: ResourceNode) => {
    setAnchorEl(event.currentTarget);
    setSelectedResource(resource);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = (resource: ResourceNode) => {
    trackEvent({
      resourceKey: 'btn.admin.resources.edit',
      action: 'CLICK',
      label: '리소스 편집',
      metadata: {
        resourceId: resource.id,
        resourceName: resource.resourceName,
      },
    });
    openEditDialog(resource);
    handleMenuClose();
  };

  const handleDelete = (resource: ResourceNode) => {
    trackEvent({
      resourceKey: 'btn.admin.resources.delete',
      action: 'CLICK',
      label: '리소스 삭제',
      metadata: {
        resourceId: resource.id,
        resourceName: resource.resourceName,
      },
    });
    setSelectedResource(resource);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  // Handle form submit
  const handleFormSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    let success = false;
    if (isCreateMode) {
      success = await createResource(draftForm);
    } else if (isEditMode && selectedResource) {
      success = await updateResource(selectedResource.id, draftForm);
    }

    if (success) {
      closeDialog(true);
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!selectedResource) return;
    const success = await deleteResource(selectedResource);
    if (success) {
      setDeleteDialogOpen(false);
      setSelectedResource(null);
    }
  };

  return (
    <Box
      data-testid="page-admin-resources"
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
        <Stack spacing={1}>
          <Typography variant="h4">리소스 관리</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            메뉴 및 리소스 권한을 관리합니다.
          </Typography>
        </Stack>

        {/* Filter Bar */}
        <ResourcesFilters
          keyword={keyword}
          resourceTypeFilter={resourceTypeFilter}
          onKeywordChange={setKeyword}
          onResourceTypeFilterChange={setResourceTypeFilter}
          onCreateClick={openCreateDialog}
        />

        {/* Tree */}
        <Card>
          <ResourcesTree
            tree={filteredTree}
            expandedNodes={expandedNodes}
            isLoading={isLoading}
            error={error}
            anchorEl={anchorEl}
            selectedResource={selectedResource}
            onToggleNode={toggleNode}
            onMenuOpen={handleMenuOpen}
            onMenuClose={handleMenuClose}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Card>
      </Stack>

      {/* Create/Edit Modal */}
      <ResourceEditorModal
        open={editorOpen}
        mode={isCreateMode ? 'create' : 'edit'}
        formData={draftForm}
        validationErrors={validationErrors}
        resourcesTree={resourcesTree || []}
        isLoading={isCreating || isUpdating}
        onClose={() => closeDialog(false)}
        onFormChange={updateFormField}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Dialog */}
      {selectedResource && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title="리소스 삭제"
          content={`정말 "${selectedResource.resourceName}" 리소스를 삭제하시겠습니까?`}
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
