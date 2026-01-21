import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import {
  getAdminMenusTree,
  createAdminMenu,
  updateAdminMenu,
  deleteAdminMenu,
  reorderAdminMenus,
} from '../api/admin-iam-api';

import type { AdminMenuNode, MenuCreatePayload, MenuUpdatePayload, MenuReorderPayload } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for admin menus tree
 * Format: ["admin", "menus", "tree", tenantId]
 */
export const adminMenusTreeQueryKey = (tenantId: string) => ['admin', 'menus', 'tree', tenantId] as const;

/**
 * Hook to fetch admin menus tree
 */
export const useAdminMenusTreeQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminMenusTreeQueryKey(tenantId),
    queryFn: async () => {
      const res = await getAdminMenusTree();
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch menus tree');
    },
    enabled: isAuthenticated && Boolean(tenantId),
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
 * Hook to create admin menu
 */
export const useCreateAdminMenuMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (payload: MenuCreatePayload) => {
      const res = await createAdminMenu(payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to create menu');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menus', 'tree', tenantId] });
      // Also invalidate auth menus tree for immediate reflection
      queryClient.invalidateQueries({ queryKey: ['auth', 'menus', 'tree', tenantId] });
    },
  });
};

/**
 * Hook to update admin menu
 */
export const useUpdateAdminMenuMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ menuId, payload }: { menuId: string; payload: MenuUpdatePayload }) => {
      const res = await updateAdminMenu(menuId, payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update menu');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menus', 'tree', tenantId] });
      // Also invalidate auth menus tree for immediate reflection
      queryClient.invalidateQueries({ queryKey: ['auth', 'menus', 'tree', tenantId] });
    },
  });
};

/**
 * Hook to delete admin menu
 */
export const useDeleteAdminMenuMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (menuId: string) => {
      const res = await deleteAdminMenu(menuId);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to delete menu');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menus', 'tree', tenantId] });
      // Also invalidate auth menus tree for immediate reflection
      queryClient.invalidateQueries({ queryKey: ['auth', 'menus', 'tree', tenantId] });
    },
  });
};

/**
 * Hook to reorder admin menus
 */
export const useReorderAdminMenusMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (payload: MenuReorderPayload) => {
      const res = await reorderAdminMenus(payload);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to reorder menus');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menus', 'tree', tenantId] });
      // Also invalidate auth menus tree for immediate reflection
      queryClient.invalidateQueries({ queryKey: ['auth', 'menus', 'tree', tenantId] });
    },
  });
};
