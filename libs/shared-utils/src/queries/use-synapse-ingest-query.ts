/**
 * Ingest Runs TanStack Query hooks
 * GET /api/synapse/admin/ingest/runs — 목록
 * GET /api/synapse/admin/ingest/runs/{runId} — 상세
 */

import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { is403Error } from '../http-error';
import {
  getIngestRuns,
  getIngestRunDetail,
  type IngestRunsListParams,
} from '../api/synapse-ingest-api';

// ----------------------------------------------------------------------
// Query Keys
// ----------------------------------------------------------------------

export const ingestRunsQueryKey = (
  tenantId: string,
  params?: IngestRunsListParams
) => ['ingestRuns', tenantId, params] as const;

export const ingestRunDetailQueryKey = (tenantId: string, runId: string) =>
  ['ingestRunDetail', tenantId, runId] as const;

// ----------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------

export const useIngestRunsQuery = (params?: IngestRunsListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: ingestRunsQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getIngestRuns(params);
      const ok = res.status === 'SUCCESS' || res.status === 'OK' || res.success === true;
      if (!ok || !res.data) {
        throw new Error(res.message || 'Failed to fetch ingest runs');
      }
      return res.data;
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: (_, error) => !is403Error(error),
  });
};

export const useIngestRunDetailQuery = (runId: string | null) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId) && Boolean(runId);

  return useQuery({
    queryKey: ingestRunDetailQueryKey(tenantId, runId ?? ''),
    queryFn: async () => {
      if (!runId) throw new Error('runId required');
      const res = await getIngestRunDetail(runId);
      const ok = res.status === 'SUCCESS' || res.status === 'OK' || res.success === true;
      if (!ok || !res.data) {
        throw new Error(res.message || 'Failed to fetch ingest run detail');
      }
      return res.data;
    },
    enabled,
    staleTime: 30 * 1000,
    retry: (_, error) => !is403Error(error),
  });
};
