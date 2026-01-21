// ----------------------------------------------------------------------

import { Iconify, PermissionGate } from '@dwp-frontend/design-system';
import { memo, useRef, useState, useEffect, useCallback } from 'react';
import { useAdminRoleDetailQuery, useAdminRoleMembersQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { EmptyState } from './empty-state';
import { RoleMembersTab } from './role-members-tab';
import { RoleOverviewTab } from './role-overview-tab';
import { RolePermissionMatrixTab } from './role-permission-matrix-tab';

import type { RoleDetailTab } from '../types';

// ----------------------------------------------------------------------

type RoleDetailPanelProps = {
  roleId: string | null;
  onCreateClick: () => void;
  onEdit: (roleId: string) => void;
  onDelete: (roleId: string) => void;
  onSuccess: () => void;
};

export const RoleDetailPanel = memo(({ roleId, onCreateClick, onEdit, onDelete, onSuccess }: RoleDetailPanelProps) => {
  const [tab, setTab] = useState<RoleDetailTab>('overview');
  const [saveState, setSaveState] = useState<{ isSaving: boolean; hasUnsavedChanges: boolean; lastSaved?: Date }>({
    isSaving: false,
    hasUnsavedChanges: false,
  });
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingTab, setPendingTab] = useState<RoleDetailTab | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const { data: roleDetail, isLoading } = useAdminRoleDetailQuery(roleId || '');
  const { data: roleMembers } = useAdminRoleMembersQuery(roleId || '');

  // Reset save state when role changes
  useEffect(() => {
    if (roleId) {
      setSaveState({ isSaving: false, hasUnsavedChanges: false });
      setTab('overview');
    }
  }, [roleId]);

  const handleTabChange = (newTab: RoleDetailTab) => {
    if (saveState.hasUnsavedChanges) {
      setPendingTab(newTab);
      setShowUnsavedDialog(true);
    } else {
      setTab(newTab);
    }
  };

  const handleSave = useCallback(async () => {
    if (!saveHandlerRef.current) return;

    setSaveState((prev) => ({ ...prev, isSaving: true }));
    try {
      await saveHandlerRef.current();
      setSaveState({
        isSaving: false,
        hasUnsavedChanges: false,
        lastSaved: new Date(),
      });
      onSuccess();
    } catch {
      setSaveState((prev) => ({ ...prev, isSaving: false }));
    }
  }, [onSuccess]);

  const handleUnsavedDialogConfirm = useCallback(() => {
    if (pendingTab) {
      setTab(pendingTab);
      setPendingTab(null);
      setSaveState((prev) => ({ ...prev, hasUnsavedChanges: false }));
    }
    setShowUnsavedDialog(false);
  }, [pendingTab]);

  const formatLastSaved = () => {
    if (!saveState.lastSaved) return null;
    return saveState.lastSaved.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleMenuDelete = () => {
    handleMenuClose();
    onDelete(roleId!);
  };

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setSaveState((prev) => {
      if (prev.hasUnsavedChanges === dirty) return prev;
      return { ...prev, hasUnsavedChanges: dirty };
    });
  }, []);

  if (!roleId) {
    return <EmptyState title="역할을 선택하세요" description="좌측에서 역할을 선택하거나 새 역할을 생성하세요." actionLabel="새 역할 생성" onAction={onCreateClick} />;
  }

  if (isLoading) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={200} />
      </Card>
    );
  }

  if (!roleDetail) {
    return (
      <Card sx={{ p: 3 }}>
        <Alert severity="error">역할 정보를 불러올 수 없습니다.</Alert>
      </Card>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, py: 2, bgcolor: 'background.paper' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {roleDetail.roleName}
              </Typography>
              <Chip
                label={roleDetail.status === 'ACTIVE' ? '활성' : '비활성'}
                color={roleDetail.status === 'ACTIVE' ? 'success' : 'default'}
                size="small"
                sx={{
                  height: 24,
                  fontSize: '0.75rem',
                  ...(roleDetail.status === 'ACTIVE'
                    ? { bgcolor: 'success.lighter', color: 'success.darker' }
                    : { bgcolor: 'action.selected', color: 'text.secondary' }),
                }}
              />
            </Stack>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              {roleDetail.roleCode}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            {saveState.lastSaved && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                <Iconify icon="solar:clock-circle-bold" width={14} />
                <Typography variant="caption">{formatLastSaved()} 저장됨</Typography>
              </Stack>
            )}

            {saveState.hasUnsavedChanges && (
              <Chip
                icon={<Iconify icon="solar:danger-triangle-bold" width={14} />}
                label="변경사항 있음"
                color="warning"
                size="small"
                variant="outlined"
                sx={{ borderColor: 'warning.main', color: 'warning.main' }}
              />
            )}

            <PermissionGate resource="menu.admin.roles" permission="UPDATE">
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!saveState.hasUnsavedChanges || saveState.isSaving}
                startIcon={<Iconify icon="solar:diskette-bold" />}
                sx={{
                  px: 2,
                  fontWeight: 600,
                  boxShadow: (theme) => theme.customShadows.primary,
                }}
              >
                {saveState.isSaving ? '저장 중...' : '저장'}
              </Button>
            </PermissionGate>

            <IconButton size="small" onClick={handleMenuOpen} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Iconify icon="solar:menu-dots-bold" width={20} />
            </IconButton>
            <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
              <MenuItem onClick={handleMenuClose}>
                <Iconify icon="solar:history-bold" width={18} sx={{ mr: 1 }} />
                변경 이력 보기
              </MenuItem>
              <MenuItem onClick={handleMenuClose}>
                <Iconify icon="solar:copy-bold" width={18} sx={{ mr: 1 }} />
                역할 복제
              </MenuItem>
              <Divider />
              <PermissionGate resource="menu.admin.roles" permission="DELETE">
                <MenuItem onClick={handleMenuDelete} sx={{ color: 'error.main' }}>
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} sx={{ mr: 1 }} />
                  역할 삭제
                </MenuItem>
              </PermissionGate>
            </Menu>
          </Stack>
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.paper' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tabs value={tab} onChange={(_, newValue) => handleTabChange(newValue as RoleDetailTab)} sx={{ minHeight: 48 }}>
            <Tab
              label="개요"
              value="overview"
              sx={{
                minHeight: 48,
                textTransform: 'none',
                fontWeight: tab === 'overview' ? 600 : 400,
                '&.Mui-selected': {
                  borderBottom: 2,
                  borderColor: 'primary.main',
                },
              }}
            />
            <Tab
              value="members"
              sx={{
                minHeight: 48,
                textTransform: 'none',
                fontWeight: tab === 'members' ? 600 : 400,
                '&.Mui-selected': {
                  borderBottom: 2,
                  borderColor: 'primary.main',
                },
              }}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>멤버</span>
                  {roleMembers && (
                    <Chip
                      label={`${roleMembers.filter((m) => m.subjectType === 'USER').length}명 / ${roleMembers.filter((m) => m.subjectType === 'DEPARTMENT').length}팀`}
                      size="small"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
              }
            />
            <Tab
              label="권한 매트릭스"
              value="permissions"
              sx={{
                minHeight: 48,
                textTransform: 'none',
                fontWeight: tab === 'permissions' ? 600 : 400,
                '&.Mui-selected': {
                  borderBottom: 2,
                  borderColor: 'primary.main',
                },
              }}
            />
          </Tabs>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 3, position: 'relative' }}>
          {tab === 'overview' && (
            <RoleOverviewTab
              roleId={roleId}
              onSuccess={onSuccess}
              onDirtyChange={handleDirtyChange}
              onSaveRequest={(handler) => {
                saveHandlerRef.current = handler;
              }}
            />
          )}
          {tab === 'members' && (
            <RoleMembersTab
              roleId={roleId}
              onSuccess={onSuccess}
              onDirtyChange={handleDirtyChange}
              onSaveRequest={(handler) => {
                saveHandlerRef.current = handler;
              }}
            />
          )}
          {tab === 'permissions' && (
            <RolePermissionMatrixTab
              roleId={roleId}
              onSuccess={onSuccess}
              onDirtyChange={handleDirtyChange}
              onSaveRequest={(handler) => {
                saveHandlerRef.current = handler;
              }}
            />
          )}
        </Box>
      </Box>

      {/* Sticky Save Bar */}
      {saveState.hasUnsavedChanges && (
        <Box
          sx={{
            p: 2,
            px: 3,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: (theme) => theme.customShadows.z20,
            zIndex: 100,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'warning.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Iconify icon="solar:danger-triangle-bold" width={20} sx={{ color: 'warning.main' }} />
            </Box>
            <Box>
              <Typography variant="subtitle2">저장되지 않은 변경사항</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                편집한 내용을 적용하려면 저장 버튼을 클릭하세요.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => {
                // To reset changes, we can just refetch or handle via tab state
                // For now, simpler to just show the button
                setSaveState((prev) => ({ ...prev, hasUnsavedChanges: false }));
                onSuccess(); // Refetch
              }}
            >
              취소
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={saveState.isSaving}
              startIcon={<Iconify icon="solar:diskette-bold" />}
              sx={{ px: 4 }}
            >
              {saveState.isSaving ? '저장 중...' : '저장하기'}
            </Button>
          </Stack>
        </Box>
      )}

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onClose={() => setShowUnsavedDialog(false)}>
        <DialogTitle>저장되지 않은 변경사항</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            저장되지 않은 변경사항이 있습니다. 탭을 이동하면 변경사항이 유실됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUnsavedDialog(false)}>취소</Button>
          <Button onClick={handleUnsavedDialogConfirm} color="warning">
            이동
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

RoleDetailPanel.displayName = 'RoleDetailPanel';
