/**
 * Synapse Phase 4 — Reporting TanStack Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { showToast } from '../toast/toast-store';
import {
  getReconRuns,
  startReconRun,
  getActionRecon,
  retryActionRecon,
  getAnalyticsKpis,
  getReconRunDetail,
  type ReconRunType,
  type AnalyticsParams,
  type StartReconRequest,
} from '../api/synapse-reporting-api';

// ----------------------------------------------------------------------
// Query Keys
// ----------------------------------------------------------------------

export const reconRunsQueryKey = (tenantId: string, runType?: ReconRunType) =>
  ['synapse', 'recon', 'runs', tenantId, runType] as const;

export const reconRunDetailQueryKey = (tenantId: string, runId: string) =>
  ['synapse', 'recon', 'run', tenantId, runId] as const;

export const actionReconQueryKey = (tenantId: string) =>
  ['synapse', 'action-recon', tenantId] as const;

export const analyticsKpisQueryKey = (tenantId: string, params?: AnalyticsParams) =>
  ['synapse', 'analytics', 'kpis', tenantId, params] as const;

// ----------------------------------------------------------------------
// Reconciliation
// ----------------------------------------------------------------------

export const useReconRunsQuery = (runType?: ReconRunType) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: reconRunsQueryKey(tenantId, runType),
    queryFn: async () => {
      const res = await getReconRuns(runType);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch runs');
      return res.data ?? [];
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useReconRunDetailQuery = (runId: string | undefined) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId) && Boolean(runId);

  return useQuery({
    queryKey: reconRunDetailQueryKey(tenantId, runId ?? ''),
    queryFn: async () => {
      if (!runId) throw new Error('Missing runId');
      const res = await getReconRunDetail(runId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch run');
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useStartReconRunMutation = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: StartReconRequest) => {
      const res = await startReconRun(body);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to start run');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'recon'] });
      showToast(t('toast.reconciliationStarted'));
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.failedToStartRun'), 'error');
    },
  });
};

// ----------------------------------------------------------------------
// Action-recon
// ----------------------------------------------------------------------

export const useActionReconQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: actionReconQueryKey(tenantId),
    queryFn: async () => {
      const res = await getActionRecon();
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch');
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useRetryActionReconMutation = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const res = await retryActionRecon(actionId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Retry failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'action-recon'] });
      showToast(t('toast.retryRequested'));
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.retryFailed'), 'error');
    },
  });
};

// ----------------------------------------------------------------------
// Analytics
// ----------------------------------------------------------------------

export const useAnalyticsKpisQuery = (params?: AnalyticsParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: analyticsKpisQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getAnalyticsKpis(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message ?? 'Failed to fetch KPIs');
      return res.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
};
