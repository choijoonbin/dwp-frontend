import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import {
  getCodeUsages,
  getCodeUsageDetail,
  createCodeUsage,
  updateCodeUsage,
  deleteCodeUsage,
} from '../api/code-usage-api';

import type {
  CodeUsageListParams,
  CodeUsageCreatePayload,
  CodeUsageUpdatePayload,
  PageResponse,
  CodeUsageSummary,
  CodeUsageDetail,
} from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for code usages list
 * Format: ["admin", "code-usages", tenantId, params]
 */
export const codeUsagesQueryKey = (tenantId: string, params?: CodeUsageListParams) =>
  [
    'admin',
    'code-usages',
    tenantId,
    params?.page,
    params?.size,
    params?.keyword,
    params?.resourceKey,
    params?.codeGroupKey,
    params?.enabled,
  ] as const;

/**
 * Query key for code usage detail
 * Format: ["admin", "code-usage", tenantId, id]
 */
export const codeUsageDetailQueryKey = (tenantId: string, id: string) =>
  ['admin', 'code-usage', tenantId, id] as const;

/**
 * Hook to fetch code usages list
 */
export const useCodeUsagesQuery = (params?: CodeUsageListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: codeUsagesQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getCodeUsages(params);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch code usages');
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
 * Hook to fetch code usage detail
 */
export const useCodeUsageDetailQuery = (id: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: codeUsageDetailQueryKey(tenantId, id),
    queryFn: async () => {
      const res = await getCodeUsageDetail(id);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch code usage');
    },
    enabled: isAuthenticated && Boolean(tenantId) && Boolean(id),
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
 * Hook to create code usage
 */
export const useCreateCodeUsageMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (payload: CodeUsageCreatePayload) => {
      const res = await createCodeUsage(payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to create code usage');
    },
    onSuccess: () => {
      // Invalidate code usages list
      queryClient.invalidateQueries({ queryKey: ['admin', 'code-usages', tenantId] });
      // Also invalidate code usage queries (for code dropdowns)
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes', 'usage'] });
    },
  });
};

/**
 * Hook to update code usage
 */
export const useUpdateCodeUsageMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CodeUsageUpdatePayload }) => {
      const res = await updateCodeUsage(id, payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update code usage');
    },
    onSuccess: (_, variables) => {
      // Invalidate code usages list and detail
      queryClient.invalidateQueries({ queryKey: ['admin', 'code-usages', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'code-usage', tenantId, variables.id] });
      // Also invalidate code usage queries (for code dropdowns)
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes', 'usage'] });
    },
  });
};

/**
 * Hook to delete code usage
 */
export const useDeleteCodeUsageMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteCodeUsage(id);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to delete code usage');
    },
    onSuccess: () => {
      // Invalidate code usages list
      queryClient.invalidateQueries({ queryKey: ['admin', 'code-usages', tenantId] });
      // Also invalidate code usage queries (for code dropdowns)
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes', 'usage'] });
    },
  });
};
