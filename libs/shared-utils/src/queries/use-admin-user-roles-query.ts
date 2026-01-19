import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAdminUserRoles, updateAdminUserRoles, resetAdminUserPassword } from '../api/admin-iam-api';

import type { RoleSummary } from '../admin/types';
import type { ResetPasswordPayload } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for admin user roles
 * Format: ["admin", "user", tenantId, userId, "roles"]
 */
export const adminUserRolesQueryKey = (tenantId: string, userId: string) =>
  ['admin', 'user', tenantId, userId, 'roles'] as const;

/**
 * Hook to fetch admin user roles
 */
export const useAdminUserRolesQuery = (userId: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminUserRolesQueryKey(tenantId, userId),
    queryFn: async () => {
      const res = await getAdminUserRoles(userId);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch user roles');
    },
    enabled: isAuthenticated && Boolean(tenantId) && Boolean(userId),
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
    mutationFn: async ({ userId, roleIds }: { userId: string; roleIds: string[] }) => {
      const res = await updateAdminUserRoles(userId, roleIds);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update user roles');
    },
    onSuccess: (_, variables) => {
      // Invalidate user roles and detail
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', tenantId, variables.userId, 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', tenantId, variables.userId] });
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', tenantId, variables.userId] });
    },
  });
};
