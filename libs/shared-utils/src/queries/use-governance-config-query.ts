import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { patchGovernanceConfig, getGovernanceConfigList } from '../api/synapse-admin-api';

import type { GovernanceConfigPatchPayload } from '../api/synapse-admin-api';

// ----------------------------------------------------------------------

export const governanceConfigQueryKey = (tenantId: string) =>
  ['synapse', 'admin', 'governance-config', tenantId] as const;

/**
 * 거버넌스 설정 목록 조회
 * GET /api/synapse/admin/governance-config
 */
export const useGovernanceConfigQuery = (options?: { enabled?: boolean }) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = options?.enabled !== false && isAuthenticated && Boolean(tenantId);

  const query = useQuery({
    queryKey: governanceConfigQueryKey(tenantId),
    queryFn: async () => {
      const res = await getGovernanceConfigList();
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch governance config');
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * 거버넌스 설정 값 변경
 * PATCH /api/synapse/admin/governance-config/{configKey}
 */
export const usePatchGovernanceConfigMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      configKey,
      payload,
    }: {
      configKey: string;
      payload: GovernanceConfigPatchPayload;
    }) => {
      const res = await patchGovernanceConfig(configKey, payload);
      if (res.status === 'SUCCESS' || res.data?.success === true) {
        return res.data ?? { success: true };
      }
      throw new Error(res.message || 'Failed to update governance config');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: governanceConfigQueryKey(tenantId) });
    },
  });
};
