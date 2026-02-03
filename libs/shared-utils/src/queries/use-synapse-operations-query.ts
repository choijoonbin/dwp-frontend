/**
 * Synapse Phase 2 — Operational TanStack Query hooks
 * cases, anomalies, actions, archive
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAuditIdFromError } from '../http-error';
import { showToast, showToastWithAuditLink } from '../toast/toast-store';
import {
  getCases,
  getActions,
  getArchive,
  createAction,
  getAnomalies,
  rejectAction,
  approveAction,
  executeAction,
  getCaseDetail,
  simulateAction,
  updateCaseStatus,
  type CasesListParams,
  type CreateActionBody,
  type ActionsListParams,
  type ArchiveListParams,
  type AnomaliesListParams,
} from '../api/synapse-operations-api';

// ----------------------------------------------------------------------
// Query Keys
// ----------------------------------------------------------------------

export const casesListQueryKey = (
  tenantId: string,
  params?: CasesListParams
) => ['synapse', 'cases', 'list', tenantId, params] as const;

export const caseDetailQueryKey = (tenantId: string, caseId: string) =>
  ['synapse', 'cases', 'detail', tenantId, caseId] as const;

export const anomaliesListQueryKey = (
  tenantId: string,
  params?: AnomaliesListParams
) => ['synapse', 'anomalies', 'list', tenantId, params] as const;

export const actionsListQueryKey = (
  tenantId: string,
  params?: ActionsListParams
) => ['synapse', 'actions', 'list', tenantId, params] as const;

export const archiveListQueryKey = (
  tenantId: string,
  params?: ArchiveListParams
) => ['synapse', 'archive', 'list', tenantId, params] as const;

// ----------------------------------------------------------------------
// Cases
// ----------------------------------------------------------------------

export const useCasesListQuery = (params?: CasesListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: casesListQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getCases(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch cases');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useCaseDetailQuery = (caseId: string | undefined) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId) && Boolean(caseId);

  return useQuery({
    queryKey: caseDetailQueryKey(tenantId, caseId ?? ''),
    queryFn: async () => {
      if (!caseId) throw new Error('Missing case ID');
      const res = await getCaseDetail(caseId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch case detail');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useUpdateCaseStatusMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      caseId,
      status,
    }: {
      caseId: string;
      status: 'TRIAGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
    }) => {
      const res = await updateCaseStatus(caseId, status);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to update case status');
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      queryClient.invalidateQueries({
        queryKey: caseDetailQueryKey(tenantId, variables.caseId),
      });
      showToast('Case status updated');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    },
  });
};

// ----------------------------------------------------------------------
// Anomalies
// ----------------------------------------------------------------------

export const useAnomaliesListQuery = (params?: AnomaliesListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: anomaliesListQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getAnomalies(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch anomalies');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

// ----------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------

export const useActionsListQuery = (params?: ActionsListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: actionsListQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getActions(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch actions');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useCreateActionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateActionBody) => {
      const res = await createAction(body);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to create action');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'actions'] });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      showToast('Action created');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to create action', 'error');
    },
  });
};

export const useApproveActionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const res = await approveAction(actionId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        const err = new Error(res.message || 'Failed to approve action') as Error & { auditId?: string };
        err.auditId = res.auditId;
        throw err;
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'actions'] });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'archive'] });
      showToast('Action approved');
    },
    onError: (err) => {
      showToastWithAuditLink(
        err instanceof Error ? err.message : 'Failed to approve',
        getAuditIdFromError(err)
      );
    },
  });
};

export const useExecuteActionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const res = await executeAction(actionId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        const err = new Error(res.message || 'Failed to execute action') as Error & { auditId?: string };
        err.auditId = res.auditId;
        throw err;
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'actions'] });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'archive'] });
      showToast('Action executed');
    },
    onError: (err) => {
      showToastWithAuditLink(
        err instanceof Error ? err.message : 'Failed to execute',
        getAuditIdFromError(err)
      );
    },
  });
};

export const useRejectActionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const res = await rejectAction(actionId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to reject action');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'actions'] });
      showToast('Action rejected');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Failed to reject', 'error');
    },
  });
};

export const useSimulateActionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const res = await simulateAction(actionId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        const err = new Error(res.message || 'Failed to simulate action') as Error & { auditId?: string };
        err.auditId = res.auditId;
        throw err;
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'actions'] });
      showToast('Simulation completed');
    },
    onError: (err) => {
      showToastWithAuditLink(
        err instanceof Error ? err.message : 'Failed to simulate',
        getAuditIdFromError(err)
      );
    },
  });
};

// ----------------------------------------------------------------------
// Archive
// ----------------------------------------------------------------------

export const useArchiveListQuery = (params?: ArchiveListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: archiveListQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getArchive(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch archive');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};
