import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAdminRoleMembers, updateAdminRoleMembers } from '../api/admin-iam-api';

import type { UserSummary, RoleMemberAssignmentPayload } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for admin role members
 * Format: ["admin", "role", tenantId, roleId, "members"]
 */
export const adminRoleMembersQueryKey = (tenantId: string, roleId: string) =>
  ['admin', 'role', tenantId, roleId, 'members'] as const;

/**
 * Hook to fetch admin role members
 */
export const useAdminRoleMembersQuery = (roleId: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminRoleMembersQueryKey(tenantId, roleId),
    queryFn: async () => {
      const res = await getAdminRoleMembers(roleId);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch role members');
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
 * Hook to update admin role members
 */
export const useUpdateAdminRoleMembersMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ roleId, payload }: { roleId: string; payload: RoleMemberAssignmentPayload }) => {
      const res = await updateAdminRoleMembers(roleId, payload);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update role members');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'role', tenantId, variables.roleId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'role', tenantId, variables.roleId] });
    },
  });
};
