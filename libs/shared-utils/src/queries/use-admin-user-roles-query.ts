import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAdminUserRoles, updateAdminUserRoles, resetAdminUserPassword } from '../api/admin-iam-api';

import type { ResetPasswordPayload } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for admin user roles
 * Format: ["admin", "users", "roles", tenantId, userId]
 */
export const adminUserRolesQueryKey = (tenantId: string, userId: string) =>
  ['admin', 'users', 'roles', tenantId, userId] as const;

export type UseAdminUserRolesQueryOptions = {
  /** true면 인증/tenant 무시하고 호출. Drawer 등에서 호출 보장용 */
  enabled?: boolean;
};

/**
 * Hook to fetch admin user roles
 * GET /api/admin/users/:userId/roles
 */
export const useAdminUserRolesQuery = (userId: string, options?: UseAdminUserRolesQueryOptions) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const enabledDefault = isAuthenticated && Boolean(tenantId) && Boolean(userId);
  const enabled = options?.enabled !== undefined ? options.enabled && Boolean(userId) : enabledDefault;

  const query = useQuery({
    queryKey: adminUserRolesQueryKey(tenantId, userId),
    queryFn: async () => {
      const res = await getAdminUserRoles(userId);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch user roles');
    },
    enabled,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * Hook to update admin user roles
 */
export const useUpdateAdminUserRolesMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ userId, roleIds, replace = true }: { userId: string; roleIds: string[]; replace?: boolean }) => {
      const res = await updateAdminUserRoles(userId, { roleIds, replace });
      // BE가 status: 'SUCCESS' + message만 반환하고 data/success 없을 수 있음 → 성공으로 처리
      if (res.status === 'SUCCESS' || res.data?.success === true) {
        return res.data ?? { success: true };
      }
      throw new Error(res.message || 'Failed to update user roles');
    },
    onSuccess: (_, variables) => {
      // Invalidate user roles and detail
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'roles', tenantId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'detail', tenantId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', tenantId] }); // Invalidate list
      // Invalidate permissions and menus if needed
      queryClient.invalidateQueries({ queryKey: ['auth', 'permissions', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'menus', tenantId] });
    },
  });
};

/**
 * Hook to reset admin user password
 */
export const useResetAdminUserPasswordMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload?: ResetPasswordPayload }) => {
      const res = await resetAdminUserPassword(userId, payload);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to reset password');
    },
    onSuccess: (_, variables) => {
      // Invalidate user detail
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'detail', tenantId, variables.userId] });
    },
  });
};
