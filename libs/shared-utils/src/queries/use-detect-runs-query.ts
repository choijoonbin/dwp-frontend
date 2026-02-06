/**
 * Detect Runs TanStack Query hooks
 * queryKey: ['detectRuns', filters, page, size, sort]
 * queryKey: ['detectRunDetail', runId]
 */

import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { is403Error } from '../http-error';
import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { showToast } from '../toast/toast-store';
import {
  runDetectNow,
  getDetectRuns,
  getDetectRunDetail,
  type DetectRunNowBody,
  getDetectSchedulerStatus,
  type DetectRunsListParams,
} from '../api/synapse-detect-api';

// ----------------------------------------------------------------------
// Query Keys
// ----------------------------------------------------------------------

export const detectSchedulerStatusQueryKey = (tenantId: string) =>
  ['detectSchedulerStatus', tenantId] as const;

export const detectRunsQueryKey = (
  tenantId: string,
  params?: DetectRunsListParams
) => ['detectRuns', tenantId, params] as const;

export const detectRunDetailQueryKey = (tenantId: string, runId: string) =>
  ['detectRunDetail', tenantId, runId] as const;

// ----------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------

export const useDetectRunsQuery = (params?: DetectRunsListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: detectRunsQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getDetectRuns(params);
      const ok = res.status === 'SUCCESS' || res.status === 'OK' || res.success === true;
      if (!ok || !res.data) {
        throw new Error(res.message || 'Failed to fetch detect runs');
      }
      return res.data;
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: (_, error) => !is403Error(error),
  });
};

export const useDetectSchedulerStatusQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: detectSchedulerStatusQueryKey(tenantId),
    queryFn: async () => {
      const res = await getDetectSchedulerStatus();
      const ok = res.status === 'SUCCESS' || res.status === 'OK' || res.success === true;
      if (!ok || !res.data) {
        throw new Error(res.message || 'Failed to fetch scheduler status');
      }
      return res.data;
    },
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: (_, error) => !is403Error(error),
  });
};

export const useDetectRunDetailQuery = (runId: string | null) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled =
    isAuthenticated && Boolean(tenantId) && Boolean(runId);

  return useQuery({
    queryKey: detectRunDetailQueryKey(tenantId, runId ?? ''),
    queryFn: async () => {
      if (!runId) throw new Error('runId required');
      const res = await getDetectRunDetail(runId);
      const ok = res.status === 'SUCCESS' || res.status === 'OK' || res.success === true;
      if (!ok || !res.data) {
        throw new Error(res.message || 'Failed to fetch run detail');
      }
      return res.data;
    },
    enabled,
    staleTime: 30 * 1000,
    retry: (_, error) => !is403Error(error),
  });
};

// ----------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------

export type RunDetectNowMutationOptions = {
  selectedRunId?: string | null;
};

export const useRunDetectNowMutation = (options?: RunDetectNowMutationOptions) => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const tenantId = getTenantId();
  const selectedRunId = options?.selectedRunId;

  return useMutation({
    mutationFn: async (body?: DetectRunNowBody) => {
      const res = await runDetectNow(body);
      const ok = res.status === 'SUCCESS' || res.status === 'OK' || res.success === true;
      if (!ok || !res.data) {
        throw new Error(res.message || 'Run failed');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['detectRuns', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['detectSchedulerStatus', tenantId] });
      if (selectedRunId) {
        queryClient.invalidateQueries({
          queryKey: ['detectRunDetail', tenantId, selectedRunId],
        });
      }
      const status = data?.status ?? 'SUCCESS';
      if (status === 'SUCCESS' || status === 'COMPLETED') {
        showToast(t('toast.batchCompleted'));
      } else if (status === 'SKIPPED') {
        const skipped = data as { runningRunId?: string; skipReason?: string };
        const extra =
          skipped.runningRunId || skipped.skipReason
            ? ` (${[skipped.runningRunId, skipped.skipReason].filter(Boolean).join(' · ')})`
            : '';
        showToast(
          extra ? t('toast.batchLockedExtra', { extra }) : t('toast.batchLocked'),
          'warning'
        );
      } else if (status === 'FAILED') {
        showToast(
          t('toast.batchFailedAudit', {
            message: data?.message ?? t('toast.batchFailed'),
          }),
          'error'
        );
      }
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.batchFailed'), 'error');
    },
  });
};
