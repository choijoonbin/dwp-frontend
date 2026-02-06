// ----------------------------------------------------------------------

import type { UserSummary, UserCreatePayload, UserUpdatePayload } from '@dwp-frontend/shared-utils';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import {
  HttpError,
  trackEvent,
  getTenantId,
  useCreateAdminUserMutation,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useUpdateAdminUserRolesMutation,
} from '@dwp-frontend/shared-utils';

import type { UserFormState } from '../types';

// ----------------------------------------------------------------------

/**
 * User Actions Hook: CRUD mutation orchestration
 * - Handles query invalidation
 * - Manages success/error states
 * - Tracks events
 */
export const useUserActions = (
  showSnackbar: (message: string, severity?: 'success' | 'error') => void,
  refetch: () => void
) => {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  const createMutation = useCreateAdminUserMutation();
  const updateMutation = useUpdateAdminUserMutation();
  const deleteMutation = useDeleteAdminUserMutation();
  const updateRolesMutation = useUpdateAdminUserRolesMutation();

  // Invalidate users queries after mutation
  const invalidateUsersQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'users', tenantId] });
    refetch();
  }, [queryClient, tenantId, refetch]);

  // Create user
  const createUser = useCallback(
    async (formData: UserFormState) => {
      try {
        const payload: UserCreatePayload = {
          userName: formData.userName,
          email: formData.email || undefined,
          departmentId: formData.departmentId || undefined,
          createLocalAccount: formData.createLocalAccount,
          principal: formData.createLocalAccount ? formData.principal || undefined : undefined,
          password: formData.createLocalAccount ? formData.password || undefined : undefined,
        };

        trackEvent({
          resourceKey: 'btn.admin.users.create',
          action: 'CLICK',
          label: '사용자 생성',
          metadata: {
            page: window.location.pathname,
            userName: formData.userName,
          },
        });

        await createMutation.mutateAsync(payload);
        invalidateUsersQueries();
        showSnackbar(t('toast.userCreated'));
        trackEvent({
          resourceKey: 'menu.admin.users',
          action: 'SUBMIT',
          label: '사용자 생성 완료',
          metadata: {
            userName: formData.userName,
          },
        });
        return true;
      } catch (error) {
        // Handle 403 Forbidden (permission denied)
        if (error instanceof HttpError && error.status === 403) {
          showSnackbar(t('error.permissionDenied'), 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (duplicate user/account)
          showSnackbar(t('error.duplicateUser'), 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : t('error.createFailed'), 'error');
        }
        return false;
      }
    },
    [createMutation, invalidateUsersQueries, showSnackbar, t]
  );

  // Update user
  const updateUser = useCallback(
    async (userId: string, formData: UserFormState) => {
      try {
        const payload: UserUpdatePayload = {
          userName: formData.userName,
          email: formData.email || undefined,
          departmentId: formData.departmentId || undefined,
          status: formData.status,
        };

        trackEvent({
          resourceKey: 'btn.admin.users.save',
          action: 'CLICK',
          label: '사용자 수정',
          metadata: {
            userId,
            userName: formData.userName,
            status: formData.status,
          },
        });

        await updateMutation.mutateAsync({ userId, payload });
        invalidateUsersQueries();
        showSnackbar(t('toast.userUpdated'));
        trackEvent({
          resourceKey: 'menu.admin.users',
          action: 'SUBMIT',
          label: '사용자 수정 완료',
          metadata: {
            userId,
            userName: formData.userName,
            status: formData.status,
          },
        });
        return true;
      } catch (error) {
        // Handle 403 Forbidden (permission denied)
        if (error instanceof HttpError && error.status === 403) {
          showSnackbar(t('error.permissionDenied'), 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (duplicate user/account)
          showSnackbar(t('error.duplicateUser'), 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : t('error.updateFailed'), 'error');
        }
        return false;
      }
    },
    [updateMutation, invalidateUsersQueries, showSnackbar, t]
  );

  // Delete user
  const deleteUser = useCallback(
    async (user: UserSummary) => {
      try {
        trackEvent({
          resourceKey: 'btn.admin.users.delete',
          action: 'CLICK',
          label: '사용자 삭제',
          metadata: {
            userId: user.id,
            userName: user.userName,
          },
        });

        await deleteMutation.mutateAsync(user.id);
        invalidateUsersQueries();
        showSnackbar(t('toast.userDeleted'));
        trackEvent({
          resourceKey: 'menu.admin.users',
          action: 'DELETE',
          label: '사용자 삭제 완료',
          metadata: {
            userId: user.id,
            userName: user.userName,
          },
        });
        return true;
      } catch (error) {
        // Handle 403 Forbidden (permission denied)
        if (error instanceof HttpError && error.status === 403) {
          showSnackbar(t('error.permissionDenied'), 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : t('error.deleteFailed'), 'error');
        }
        return false;
      }
    },
    [deleteMutation, invalidateUsersQueries, showSnackbar, t]
  );

  // Update user roles
  const updateUserRoles = useCallback(
    async (userId: string, roleIds: string[], replace: boolean = true) => {
      try {
        trackEvent({
          resourceKey: 'btn.admin.users.roles',
          action: 'CLICK',
          label: '역할 할당',
          metadata: {
            userId,
            roleIds,
            replace,
          },
        });

        await updateRolesMutation.mutateAsync({ userId, roleIds, replace });
        invalidateUsersQueries();
        showSnackbar(t('toast.roleAssigned'), 'success');
        trackEvent({
          resourceKey: 'menu.admin.users',
          action: 'EDIT',
          label: '역할 변경 완료',
          metadata: {
            userId,
            roleIds,
            replace,
          },
        });
        return true;
      } catch (error) {
        showSnackbar(error instanceof Error ? error.message : t('toast.roleAssignFailed'), 'error');
        return false;
      }
    },
    [updateRolesMutation, invalidateUsersQueries, showSnackbar, t]
  );

  return {
    // Mutations
    createUser,
    updateUser,
    deleteUser,
    updateUserRoles,
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isUpdatingRoles: updateRolesMutation.isPending,
  };
};
