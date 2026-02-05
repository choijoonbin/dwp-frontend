// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Iconify, ConfirmDialog, TwoColumnLayout } from '@dwp-frontend/design-system';
import { HttpError, trackEvent, PermissionRouteGuard } from '@dwp-frontend/shared-utils';
import {
  useCodeGroupsQuery,
  type CodeUsageSummary,
  useCreateCodeUsageMutation,
  useUpdateCodeUsageMutation,
  useDeleteCodeUsageMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';

import { CodeGroupsPanel } from './components/code-groups-panel';
import { ResourceMenuList } from './components/resource-menu-list';
import { CodeUsageEditorModal } from './components/code-usage-editor-modal';
import { useCodeUsagesTableState } from './hooks/use-code-usages-table-state';

// ----------------------------------------------------------------------

export const CodeUsagesPage = () => (
  <PermissionRouteGuard resource="menu.admin.code-usages" permission="VIEW" redirectTo="/403">
    <CodeUsagesPageContent />
  </PermissionRouteGuard>
);

const CodeUsagesPageContent = () => {
  const { t } = useTranslation('admin');
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
      showSnackbar(!usage.enabled ? t('toast.codeGroupEnabled') : t('toast.codeGroupDisabled'));
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
      showSnackbar(err instanceof Error ? err.message : t('error.statusChangeFailed'), 'error');
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
        showSnackbar(t('toast.codeGroupUpdated'));
      } else {
        await createMutation.mutateAsync({
          resourceKey: formData.resourceKey,
          codeGroupKey: formData.codeGroupKey,
          enabled: formData.enabled,
        });
        showSnackbar(t('toast.codeGroupAdded'));
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
        showSnackbar(t('error.duplicateCodeGroup'), 'error');
      } else {
        showSnackbar(err instanceof Error ? err.message : t('error.saveFailed'), 'error');
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUsage) return;
    try {
      await deleteMutation.mutateAsync(selectedUsage.id);
      setDeleteDialogOpen(false);
      refetch();
      showSnackbar(t('toast.codeGroupDeleted'));
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
      showSnackbar(err instanceof Error ? err.message : t('error.deleteFailed'), 'error');
    }
  };

  return (
    <Box
      data-testid="page-admin-code-usages"
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
          <Typography variant="h4">코드 사용 매핑 관리</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            메뉴별로 사용할 코드 그룹을 정의합니다. 매핑된 코드 그룹의 코드는 해당 메뉴의 드롭다운에서 사용할 수 있습니다.
          </Typography>
        </Stack>

        <Alert
          severity="info"
          icon={<Iconify icon="solar:info-circle-bold" width={18} />}
          sx={{ alignItems: 'center' }}
        >
          <strong>코드 사용 정의(CodeUsage)</strong>는 메뉴별로 사용 가능한 드롭다운 코드 그룹을 매핑합니다.
          매핑이 없으면 해당 화면의 selectbox가 비활성화됩니다.
        </Alert>

        {/* Main Content: Left Menu List + Right Groups Panel */}
        <TwoColumnLayout
          mode="fixed"
          leftWidth={360}
          left={
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
          }
          right={
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
          }
        />
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
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title={t('confirm.deleteCodeGroup')}
          description={t('confirm.deleteCodeGroupContent', {
            codeGroupKey: selectedUsage.codeGroupKey,
            resourceKey: selectedUsage.resourceKey,
          })}
          confirmText={t('confirm.delete')}
          cancelText={t('confirm.cancel')}
          severity="danger"
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
