// ----------------------------------------------------------------------

import type { RoleSummary, RoleCreatePayload, RoleUpdatePayload } from '@dwp-frontend/shared-utils';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  HttpError,
  trackEvent,
  getTenantId,
  useCreateAdminRoleMutation,
  useUpdateAdminRoleMutation,
  useDeleteAdminRoleMutation,
} from '@dwp-frontend/shared-utils';

import type { RoleFormState } from '../types';

// ----------------------------------------------------------------------

/**
 * Role Actions Hook: CRUD mutation orchestration
 * - Handles query invalidation
 * - Manages success/error states
 * - Tracks events
 */
export const useRoleActions = (
  openCreateDialog: () => void,
  openEditDialog: (role: RoleSummary) => void,
  setDeleteDialogOpen: (open: boolean) => void,
  setSelectedRole: (role: RoleSummary | null) => void,
  showSnackbar: (message: string, severity?: 'success' | 'error') => void,
  refetch: () => void,
  setSelectedRoleId: (id: string | null) => void
) => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  const createMutation = useCreateAdminRoleMutation();
  const updateMutation = useUpdateAdminRoleMutation();
  const deleteMutation = useDeleteAdminRoleMutation();

  // Invalidate roles queries after mutation
  // CRITICAL: Also invalidate auth queries to reflect changes immediately in sidebar/permissions
  const invalidateRolesQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'roles', tenantId] });
    // Invalidate auth queries for immediate reflection in sidebar and permissions
    queryClient.invalidateQueries({ queryKey: ['auth', 'menus', 'tree', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['auth', 'permissions', tenantId] });
    refetch();
  }, [queryClient, tenantId, refetch]);

  // Create role
  const createRole = useCallback(
    async (formData: RoleFormState) => {
      try {
        const payload: RoleCreatePayload = {
          roleName: formData.roleName,
          roleCode: formData.roleCode,
          description: formData.description || undefined,
          status: formData.status,
        };

        trackEvent({
          resourceKey: 'btn.admin.roles.create',
          action: 'CLICK',
          label: '역할 생성',
          metadata: {
            page: window.location.pathname,
            roleName: formData.roleName,
            roleCode: formData.roleCode,
          },
        });

        await createMutation.mutateAsync(payload);
        invalidateRolesQueries();
        showSnackbar('역할이 생성되었습니다.');
        return true;
      } catch (error) {
        // Handle 403 Forbidden (permission denied)
        if (error instanceof HttpError && error.status === 403) {
          showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : '생성에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [createMutation, invalidateRolesQueries, showSnackbar]
  );

  // Update role
  const updateRole = useCallback(
    async (roleId: string, formData: RoleFormState) => {
      try {
        const payload: RoleUpdatePayload = {
          roleName: formData.roleName,
          roleCode: formData.roleCode,
          description: formData.description || undefined,
          status: formData.status,
        };

        trackEvent({
          resourceKey: 'btn.admin.roles.save',
          action: 'CLICK',
          label: '역할 수정',
          metadata: {
            roleId,
            roleName: formData.roleName,
            status: formData.status,
          },
        });

        await updateMutation.mutateAsync({ roleId, payload });
        invalidateRolesQueries();
        showSnackbar('역할이 수정되었습니다.');
        return true;
      } catch (error) {
        // Handle 403 Forbidden (permission denied)
        if (error instanceof HttpError && error.status === 403) {
          showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : '수정에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [updateMutation, invalidateRolesQueries, showSnackbar]
  );

  // Delete role
  const deleteRole = useCallback(
    async (role: RoleSummary, selectedRoleId: string | null) => {
      try {
        trackEvent({
          resourceKey: 'btn.admin.roles.delete',
          action: 'CLICK',
          label: '역할 삭제',
          metadata: {
            roleId: role.id,
            roleName: role.roleName,
          },
        });

        await deleteMutation.mutateAsync(role.id);
        invalidateRolesQueries();

        // Clear selection if deleted role was selected
        if (selectedRoleId === role.id) {
          setSelectedRoleId(null);
        }

        showSnackbar('역할이 삭제되었습니다.');
        return true;
      } catch (error) {
        // Handle 403 Forbidden (permission denied)
        if (error instanceof HttpError && error.status === 403) {
          showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (ROLE_IN_USE)
          showSnackbar('멤버 또는 권한 매핑이 있는 역할은 삭제할 수 없습니다. 매핑을 해제한 후 다시 시도해주세요.', 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [deleteMutation, invalidateRolesQueries, setSelectedRoleId, showSnackbar]
  );

  // UI Actions (open dialogs)
  const handleCreate = useCallback(() => {
    trackEvent({
      resourceKey: 'btn.admin.roles.create',
      action: 'CLICK',
      label: '역할 추가',
      metadata: {
        page: window.location.pathname,
        actionDetail: 'open_create_dialog',
      },
    });
    setSelectedRole(null);
    openCreateDialog();
  }, [setSelectedRole, openCreateDialog]);

  const handleEdit = useCallback(
    (role: RoleSummary) => {
      trackEvent({
        resourceKey: 'btn.admin.roles.edit',
        action: 'CLICK',
        label: '역할 편집',
        metadata: {
          roleId: role.id,
          roleName: role.roleName,
        },
      });
      setSelectedRole(role);
      openEditDialog(role);
    },
    [setSelectedRole, openEditDialog]
  );

  const handleDelete = useCallback(
    (role: RoleSummary) => {
      trackEvent({
        resourceKey: 'btn.admin.roles.delete',
        action: 'CLICK',
        label: '역할 삭제',
        metadata: {
          roleId: role.id,
          roleName: role.roleName,
        },
      });
      setSelectedRole(role);
      setDeleteDialogOpen(true);
    },
    [setSelectedRole, setDeleteDialogOpen]
  );

  return {
    // Mutations
    createRole,
    updateRole,
    deleteRole,
    // UI Actions
    handleCreate,
    handleEdit,
    handleDelete,
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
