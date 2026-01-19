import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import {
  getCodeGroups,
  createCodeGroup,
  updateCodeGroup,
  deleteCodeGroup,
} from '../api/admin-iam-api';

import type { CodeGroup, CodeGroupCreatePayload, CodeGroupUpdatePayload } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for code groups
 * Format: ["admin", "codes", "groups", tenantId]
 */
export const codeGroupsQueryKey = (tenantId: string) => ['admin', 'codes', 'groups', tenantId] as const;

/**
 * Hook to fetch code groups
 */
export const useCodeGroupsQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: codeGroupsQueryKey(tenantId),
    queryFn: async () => {
      const res = await getCodeGroups();
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch code groups');
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
 * Hook to create code group
 */
export const useCreateCodeGroupMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (payload: CodeGroupCreatePayload) => {
      const res = await createCodeGroup(payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to create code group');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes', 'groups', tenantId] });
    },
  });
};

/**
 * Hook to update code group
 */
export const useUpdateCodeGroupMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ groupId, payload }: { groupId: string; payload: CodeGroupUpdatePayload }) => {
      const res = await updateCodeGroup(groupId, payload);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update code group');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes', 'groups', tenantId] });
    },
  });
};

/**
 * Hook to delete code group
 */
export const useDeleteCodeGroupMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await deleteCodeGroup(groupId);
      if (res.data?.success) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to delete code group');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes', 'groups', tenantId] });
    },
  });
};
