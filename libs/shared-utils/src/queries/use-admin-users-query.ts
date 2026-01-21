import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, disableAdminUser } from '../api/admin-iam-api';

import type { UserListParams, UserCreatePayload, UserUpdatePayload, PageResponse, UserSummary } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for admin users list
 * Format: ["admin", "users", tenantId, params]
 */
export const adminUsersQueryKey = (tenantId: string, params?: UserListParams) =>
  ['admin', 'users', tenantId, params?.page, params?.size, params?.keyword, params?.departmentId, params?.status] as const;

/**
 * Hook to fetch admin users list
 */
export const useAdminUsersQuery = (params?: UserListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminUsersQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getAdminUsers(params);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch users');
    },
    enabled: isAuthenticated && Boolean(tenantId),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * Hook to create admin user
 */
export const useCreateAdminUserMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (payload: UserCreatePayload) => {
      const res = await createAdminUser(payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to create user');
    },
    onSuccess: () => {
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', tenantId] });
    },
  });
};

/**
 * Hook to update admin user
 */
export const useUpdateAdminUserMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: UserUpdatePayload }) => {
      const res = await updateAdminUser(userId, payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update user');
    },
    onSuccess: (_, variables) => {
      // Invalidate users list and detail
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'detail', tenantId, variables.userId] });
    },
  });
};

/**
 * Hook to delete admin user
 */
export const useDeleteAdminUserMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await deleteAdminUser(userId);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to delete user');
    },
    onSuccess: () => {
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', tenantId] });
    },
  });
};

/**
 * Hook to disable admin user (soft delete)
 */
export const useDisableAdminUserMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await disableAdminUser(userId);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to disable user');
    },
    onSuccess: () => {
      // Invalidate users list and detail
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', tenantId] });
    },
  });
};
