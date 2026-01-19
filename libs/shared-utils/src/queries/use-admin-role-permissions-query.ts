import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAdminRolePermissions, updateAdminRolePermissions } from '../api/admin-iam-api';

import type { RolePermissionAssignmentPayload } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for admin role permissions
 * Format: ["admin", "role", tenantId, roleId, "permissions"]
 */
export const adminRolePermissionsQueryKey = (tenantId: string, roleId: string) =>
  ['admin', 'role', tenantId, roleId, 'permissions'] as const;

/**
 * Hook to fetch admin role permissions
 */
export const useAdminRolePermissionsQuery = (roleId: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminRolePermissionsQueryKey(tenantId, roleId),
    queryFn: async () => {
      const res = await getAdminRolePermissions(roleId);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch role permissions');
    },
    enabled: isAuthenticated && Boolean(tenantId) && Boolean(roleId),
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
 * Hook to update admin role permissions
 */
export const useUpdateAdminRolePermissionsMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      roleId,
      payload,
    }: {
      roleId: string;
      payload: RolePermissionAssignmentPayload;
    }) => {
      const res = await updateAdminRolePermissions(roleId, payload);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update role permissions');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'role', tenantId, variables.roleId, 'permissions'],
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'role', tenantId, variables.roleId] });
    },
  });
};
