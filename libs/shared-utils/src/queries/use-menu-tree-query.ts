import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { getMenuTree } from '../api/auth-api';
import { useAuth } from '../auth/auth-provider';
import { useMenuTreeStore } from '../auth/menu-tree-store';

import type { MenuNode } from '../auth/types';

// ----------------------------------------------------------------------

/**
 * Query key for menu tree
 * Format: ["auth", "menus", "tree", tenantId]
 */
export const menuTreeQueryKey = (tenantId: string) => ['auth', 'menus', 'tree', tenantId] as const;

/**
 * Hook to fetch and manage menu tree
 * Automatically syncs with menuTreeStore
 * Enabled only when logged in and tenantId exists
 */
export const useMenuTreeQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const { menuTree, isLoaded, actions } = useMenuTreeStore();

  const query = useQuery({
    queryKey: menuTreeQueryKey(tenantId),
    queryFn: async () => {
      const res = await getMenuTree();
      if (res.data?.menus && Array.isArray(res.data.menus)) {
        actions.setMenuTree(res.data.menus);
        return res.data.menus;
      }
      return [];
    },
    enabled: isAuthenticated && Boolean(tenantId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  return {
    menuTree,
    isLoaded: isLoaded && query.isSuccess,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
