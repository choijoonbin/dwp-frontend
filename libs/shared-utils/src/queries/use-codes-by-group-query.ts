import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { createCode, updateCode, deleteCode, getCodesByGroup } from '../api/admin-iam-api';

import type { CodeCreatePayload, CodeUpdatePayload } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for codes by group
 * Format: ["admin", "codes", tenantId, groupKey]
 */
export const codesByGroupQueryKey = (tenantId: string, groupKey: string) =>
  ['admin', 'codes', tenantId, groupKey] as const;

/**
 * Hook to fetch codes by group
 */
export const useCodesByGroupQuery = (groupKey: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: codesByGroupQueryKey(tenantId, groupKey),
    queryFn: async () => {
      const res = await getCodesByGroup(groupKey);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch codes');
    },
    enabled: isAuthenticated && Boolean(tenantId) && Boolean(groupKey),
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
 * Hook to create code
 */
export const useCreateCodeMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (payload: CodeCreatePayload) => {
      const res = await createCode(payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to create code');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes', tenantId, data.groupKey] });
    },
  });
};

/**
 * Hook to update code
 */
export const useUpdateCodeMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ codeId, payload }: { codeId: string; payload: CodeUpdatePayload }) => {
      const res = await updateCode(codeId, payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update code');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes', tenantId, data.groupKey] });
    },
  });
};

/**
 * Hook to delete code
 */
export const useDeleteCodeMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ codeId, groupKey }: { codeId: string; groupKey: string }) => {
      const res = await deleteCode(codeId);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to delete code');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes', tenantId, variables.groupKey] });
    },
  });
};
