// ----------------------------------------------------------------------

import type { UserSummary, UserCreatePayload, UserUpdatePayload } from '@dwp-frontend/shared-utils';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  trackEvent,
  getTenantId,
  HttpError,
  useCreateAdminUserMutation,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useDisableAdminUserMutation,
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
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  const createMutation = useCreateAdminUserMutation();
  const updateMutation = useUpdateAdminUserMutation();
  const deleteMutation = useDeleteAdminUserMutation();
  const disableMutation = useDisableAdminUserMutation();
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
        showSnackbar('사용자가 생성되었습니다.');
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
          showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (duplicate user/account)
          showSnackbar('중복된 사용자 또는 계정입니다. 다른 이름이나 이메일을 사용해주세요.', 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : '생성에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [createMutation, invalidateUsersQueries, showSnackbar]
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
        showSnackbar('사용자가 수정되었습니다.');
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
          showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
        } else if (error instanceof HttpError && error.status === 409) {
          // Handle 409 Conflict (duplicate user/account)
          showSnackbar('중복된 사용자 또는 계정입니다. 다른 이름이나 이메일을 사용해주세요.', 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : '수정에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [updateMutation, invalidateUsersQueries, showSnackbar]
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
        showSnackbar('사용자가 삭제되었습니다.');
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
          showSnackbar('권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.', 'error');
        } else {
          showSnackbar(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
        }
        return false;
      }
    },
    [deleteMutation, invalidateUsersQueries, showSnackbar]
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
        showSnackbar('역할이 할당되었습니다.');
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
        showSnackbar(error instanceof Error ? error.message : '역할 할당에 실패했습니다.', 'error');
        return false;
      }
    },
    [updateRolesMutation, invalidateUsersQueries, showSnackbar]
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
