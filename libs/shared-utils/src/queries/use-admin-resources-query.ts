import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import {
  getAdminResources,
  getAdminResourcesTree,
  getAdminResourceDetail,
  createAdminResource,
  updateAdminResource,
  deleteAdminResource,
} from '../api/admin-iam-api';

import type {
  ResourceListParams,
  ResourceCreatePayload,
  ResourceUpdatePayload,
  PageResponse,
  ResourceSummary,
  ResourceNode,
} from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for admin resources list
 * Format: ["admin", "resources", tenantId, params]
 */
export const adminResourcesQueryKey = (tenantId: string, params?: ResourceListParams) =>
  [
    'admin',
    'resources',
    tenantId,
    params?.page,
    params?.size,
    params?.keyword,
    params?.resourceType,
  ] as const;

/**
 * Query key for admin resources tree
 * Format: ["admin", "resources", "tree", tenantId]
 */
export const adminResourcesTreeQueryKey = (tenantId: string) => ['admin', 'resources', 'tree', tenantId] as const;

/**
 * Query key for admin resource detail
 * Format: ["admin", "resource", tenantId, resourceId]
 */
export const adminResourceDetailQueryKey = (tenantId: string, resourceId: string) =>
  ['admin', 'resource', tenantId, resourceId] as const;

/**
 * Hook to fetch admin resources list
 */
export const useAdminResourcesQuery = (params?: ResourceListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminResourcesQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getAdminResources(params);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch resources');
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
 * Hook to fetch admin resources tree
 */
export const useAdminResourcesTreeQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminResourcesTreeQueryKey(tenantId),
    queryFn: async () => {
      const res = await getAdminResourcesTree();
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch resources tree');
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
 * Hook to fetch admin resource detail
 */
export const useAdminResourceDetailQuery = (resourceId: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminResourceDetailQueryKey(tenantId, resourceId),
    queryFn: async () => {
      const res = await getAdminResourceDetail(resourceId);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch resource detail');
    },
    enabled: isAuthenticated && Boolean(tenantId) && Boolean(resourceId),
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
 * Hook to create admin resource
 */
export const useCreateAdminResourceMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (payload: ResourceCreatePayload) => {
      const res = await createAdminResource(payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to create resource');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources', 'tree', tenantId] });
    },
  });
};

/**
 * Hook to update admin resource
 */
export const useUpdateAdminResourceMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ resourceId, payload }: { resourceId: string; payload: ResourceUpdatePayload }) => {
      const res = await updateAdminResource(resourceId, payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update resource');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources', 'tree', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'resource', tenantId, variables.resourceId] });
    },
  });
};

/**
 * Hook to delete admin resource
 */
export const useDeleteAdminResourceMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (resourceId: string) => {
      const res = await deleteAdminResource(resourceId);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to delete resource');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources', 'tree', tenantId] });
    },
  });
};
