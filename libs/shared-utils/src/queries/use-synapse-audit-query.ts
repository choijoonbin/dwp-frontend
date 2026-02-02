import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import {
  getSynapseAuditEvents,
  type SynapseAuditEventsParams,
} from '../api/synapse-admin-api';

// ----------------------------------------------------------------------

export const synapseAuditEventsQueryKey = (
  tenantId: string,
  params?: SynapseAuditEventsParams
) => ['synapse', 'audit', 'events', tenantId, params] as const;

/**
 * Synapse 감사 로그 목록 조회
 * GET /api/synapse/audit/events
 * category, type, resourceType 등 쿼리 파라미터 지원
 */
export const useSynapseAuditEventsQuery = (
  params?: SynapseAuditEventsParams,
  options?: { enabled?: boolean }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled =
    options?.enabled !== false && isAuthenticated && Boolean(tenantId);

  const query = useQuery({
    queryKey: synapseAuditEventsQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getSynapseAuditEvents(params);
      if (res.data) return res.data;
      throw new Error(res.message || 'Failed to fetch audit events');
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
