// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { HttpError, trackEvent, PermissionRouteGuard } from '@dwp-frontend/shared-utils';
import {
  useCodeGroupsQuery,
  type CodeUsageSummary,
  useCreateCodeUsageMutation,
  useUpdateCodeUsageMutation,
  useDeleteCodeUsageMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';

import { CodeGroupsPanel } from './components/code-groups-panel';
import { ResourceMenuList } from './components/resource-menu-list';
import { DeleteConfirmDialog } from './components/delete-confirm-dialog';
import { CodeUsageEditorModal } from './components/code-usage-editor-modal';
import { useCodeUsagesTableState } from './hooks/use-code-usages-table-state';

// ----------------------------------------------------------------------

export const CodeUsagesPage = () => (
  <PermissionRouteGuard resource="menu.admin.code-usages" permission="VIEW" redirectTo="/403">
    <CodeUsagesPageContent />
  </PermissionRouteGuard>
);

const CodeUsagesPageContent = () => {
  const {
    keyword,
    selectedResourceKey,
    setKeyword,
    setSelectedResourceKey,
    resourceKeyOptions,
    filteredUsages,
    usagesByResource,
    isLoading,
    error,
    refetch,
  } = useCodeUsagesTableState();

  const { data: codeGroups } = useCodeGroupsQuery();
  const createMutation = useCreateCodeUsageMutation();
  const updateMutation = useUpdateCodeUsageMutation();
  const deleteMutation = useDeleteCodeUsageMutation();

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUsage, setSelectedUsage] = useState<CodeUsageSummary | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Extract unique code group keys
  const codeGroupKeyOptions = codeGroups?.map((g) => g.groupKey).sort() || [];

  // Get groups for selected resource
  const selectedResourceGroups = selectedResourceKey
    ? filteredUsages.filter((usage) => usage.resourceKey === selectedResourceKey)
    : [];

  // Track page view
  useEffect(() => {
    trackEvent({
      resourceKey: 'menu.admin.code-usages',
      action: 'VIEW',
      label: '코드 사용 매핑 관리',
      metadata: {
        page: window.location.pathname,
      },
    });
  }, []);

  const handleAddGroup = () => {
    trackEvent({
      resourceKey: 'btn.admin.code-usages.create',
      action: 'CLICK',
      label: '코드 그룹 추가',
      metadata: {
        resourceKey: selectedResourceKey,
      },
    });
    setSelectedUsage(null);
    setGroupDialogOpen(true);
  };

  const handleEdit = (usage: CodeUsageSummary) => {
    trackEvent({
      resourceKey: 'btn.admin.code-usages.edit',
      action: 'CLICK',
      label: '코드 그룹 편집',
      metadata: {
        usageId: usage.id,
        resourceKey: usage.resourceKey,
        codeGroupKey: usage.codeGroupKey,
      },
    });
    setSelectedUsage(usage);
    setGroupDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDelete = (usage: CodeUsageSummary) => {
    trackEvent({
      resourceKey: 'btn.admin.code-usages.delete',
      action: 'CLICK',
      label: '코드 그룹 삭제',
      metadata: {
        usageId: usage.id,
        resourceKey: usage.resourceKey,
        codeGroupKey: usage.codeGroupKey,
      },
    });
    setSelectedUsage(usage);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleToggleEnabled = async (usage: CodeUsageSummary) => {
    try {
      trackEvent({
        resourceKey: 'btn.admin.code-usages.toggle',
        action: 'CLICK',
        label: '코드 그룹 활성화 토글',
        metadata: {
          usageId: usage.id,
          resourceKey: usage.resourceKey,
          codeGroupKey: usage.codeGroupKey,
          enabled: !usage.enabled,
        },
      });
      await updateMutation.mutateAsync({
        id: usage.id,
        payload: {
          enabled: !usage.enabled,
        },
      });
      refetch();
      showSnackbar(`코드 그룹이 ${!usage.enabled ? '활성화' : '비활성화'}되었습니다.`);
      trackEvent({
        resourceKey: 'menu.admin.code-usages',
        action: 'UPDATE_CODE_USAGE',
        label: '코드 그룹 활성화 토글 완료',
        metadata: {
          usageId: usage.id,
          enabled: !usage.enabled,
        },
      });
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '상태 변경에 실패했습니다.', 'error');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, usage: CodeUsageSummary) => {
    setAnchorEl(event.currentTarget);
    setSelectedUsage(usage);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSubmit = async (formData: { resourceKey: string; codeGroupKey: string; enabled: boolean }) => {
    try {
      if (selectedUsage) {
        await updateMutation.mutateAsync({
          id: selectedUsage.id,
          payload: {
            enabled: formData.enabled,
          },
        });
        showSnackbar('코드 그룹이 수정되었습니다.');
      } else {
        await createMutation.mutateAsync({
          resourceKey: formData.resourceKey,
          codeGroupKey: formData.codeGroupKey,
          enabled: formData.enabled,
        });
        showSnackbar('코드 그룹이 추가되었습니다.');
      }
      setGroupDialogOpen(false);
      refetch();
      trackEvent({
        resourceKey: 'menu.admin.code-usages',
        action: selectedUsage ? 'UPDATE_CODE_USAGE' : 'CREATE_CODE_USAGE',
        label: selectedUsage ? '코드 그룹 수정 완료' : '코드 그룹 추가 완료',
        metadata: {
          resourceKey: formData.resourceKey,
          codeGroupKey: formData.codeGroupKey,
        },
      });
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        showSnackbar('이미 등록된 코드 그룹입니다.', 'error');
      } else {
        showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUsage) return;
    try {
      await deleteMutation.mutateAsync(selectedUsage.id);
      setDeleteDialogOpen(false);
      refetch();
      showSnackbar('코드 그룹이 삭제되었습니다.');
      trackEvent({
        resourceKey: 'menu.admin.code-usages',
        action: 'DELETE_CODE_USAGE',
        label: '코드 그룹 삭제 완료',
        metadata: {
          usageId: selectedUsage.id,
          resourceKey: selectedUsage.resourceKey,
          codeGroupKey: selectedUsage.codeGroupKey,
        },
      });
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4">코드 사용 매핑 관리</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            메뉴별로 사용할 코드 그룹을 정의합니다. 매핑된 코드 그룹의 코드는 해당 메뉴의 드롭다운에서 사용할 수 있습니다.
          </Typography>
        </Stack>

        {/* Main Content: Left Menu List + Right Groups Panel */}
        <Grid container spacing={2}>
          {/* Left: Resource Menu List */}
          <Grid size={{ xs: 12, md: 4 }}>
            <ResourceMenuList
              resourceKeyOptions={resourceKeyOptions}
              selectedResourceKey={selectedResourceKey}
              keyword={keyword}
              isLoading={isLoading}
              error={error}
              usagesByResource={usagesByResource}
              onResourceSelect={setSelectedResourceKey}
              onKeywordChange={setKeyword}
            />
          </Grid>

          {/* Right: Code Groups Panel */}
          <Grid size={{ xs: 12, md: 8 }}>
            <CodeGroupsPanel
              resourceKey={selectedResourceKey}
              groups={selectedResourceGroups}
              isLoading={isLoading}
              error={error}
              anchorEl={anchorEl}
              selectedUsage={selectedUsage}
              onMenuOpen={handleMenuOpen}
              onMenuClose={handleMenuClose}
              onAddGroup={handleAddGroup}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleEnabled={handleToggleEnabled}
            />
          </Grid>
        </Grid>
      </Stack>

      {/* Group Editor Modal */}
      <CodeUsageEditorModal
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        usage={selectedUsage}
        resourceKey={selectedResourceKey}
        resourceKeyOptions={resourceKeyOptions}
        codeGroupKeyOptions={codeGroupKeyOptions}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      {selectedUsage && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title="코드 그룹 삭제"
          content={`정말 "${selectedUsage.codeGroupKey}" 코드 그룹을 "${selectedUsage.resourceKey}"에서 제거하시겠습니까?`}
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
    </Box>
  );
};
