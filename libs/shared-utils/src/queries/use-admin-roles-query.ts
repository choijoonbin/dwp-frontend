import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import {
  getAdminRoles,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  disableAdminRole,
  getAdminRoleDetail,
} from '../api/admin-iam-api';

import type { RoleListParams, RoleCreatePayload, RoleUpdatePayload } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for admin roles list
 * Format: ["admin", "roles", tenantId, params]
 */
export const adminRolesQueryKey = (tenantId: string, params?: RoleListParams) =>
  ['admin', 'roles', tenantId, params?.page, params?.size, params?.keyword, params?.status] as const;

/**
 * Query key for admin role detail
 * Format: ["admin", "role", tenantId, roleId]
 */
export const adminRoleDetailQueryKey = (tenantId: string, roleId: string) =>
  ['admin', 'role', tenantId, roleId] as const;

/**
 * Hook to fetch admin roles list
 */
export const useAdminRolesQuery = (params?: RoleListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminRolesQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getAdminRoles(params);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch roles');
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
 * Hook to fetch admin role detail
 */
export const useAdminRoleDetailQuery = (roleId: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminRoleDetailQueryKey(tenantId, roleId),
    queryFn: async () => {
      const res = await getAdminRoleDetail(roleId);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch role detail');
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
 * Hook to create admin role
 */
export const useCreateAdminRoleMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (payload: RoleCreatePayload) => {
      const res = await createAdminRole(payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to create role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles', tenantId] });
    },
  });
};

/**
 * Hook to update admin role
 */
export const useUpdateAdminRoleMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ roleId, payload }: { roleId: string; payload: RoleUpdatePayload }) => {
      const res = await updateAdminRole(roleId, payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update role');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'role', tenantId, variables.roleId] });
    },
  });
};

/**
 * Hook to delete admin role
 */
export const useDeleteAdminRoleMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const res = await deleteAdminRole(roleId);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to delete role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles', tenantId] });
    },
  });
};

/**
 * Hook to disable admin role (soft delete)
 */
export const useDisableAdminRoleMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const res = await disableAdminRole(roleId);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to disable role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles', tenantId] });
    },
  });
};
