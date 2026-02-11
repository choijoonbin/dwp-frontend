/**
 * Synapse Phase 2 — Operational TanStack Query hooks
 * cases, anomalies, actions, archive
 */

import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAuditIdFromError } from '../http-error';
import { buildAuditUrl } from '../contracts/synapse-filters';
import { showToast, showToastWithAuditLink } from '../toast/toast-store';
import {
  executeProposal,
  getAnalysisRuns,
  getCaseActionProposals,
  submitActionProposalDecision,
} from '../api/synapse-analysis-api';
import {
  getCases,
  getActions,
  getArchive,
  getAnomalies,
  createAction,
  rejectAction,
  resumeAction,
  getCaseDetail,
  approveAction,
  executeAction,
  getCaseSimilar,
  simulateAction,
  getActionDetail,
  getCaseAnalysis,
  updateCaseStatus,
  getCaseConfidence,
  getCaseAuditEvents,
  getCaseRagEvidence,
  type CasesListParams,
  type CreateActionBody,
  type ActionsListParams,
  type ArchiveListParams,
  type AnomaliesListParams,
  type CaseAuditEventsParams,
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

export const caseAuditEventsQueryKey = (
  tenantId: string,
  caseId: string,
  params?: CaseAuditEventsParams
) => ['synapse', 'cases', 'audit-events', tenantId, caseId, params] as const;

export const caseAnalysisQueryKey = (tenantId: string, caseId: string, runId?: string | null) =>
  ['synapse', 'cases', 'analysis', tenantId, caseId, runId ?? ''] as const;

export const caseConfidenceQueryKey = (tenantId: string, caseId: string) =>
  ['synapse', 'cases', 'confidence', tenantId, caseId] as const;

export const caseSimilarQueryKey = (tenantId: string, caseId: string) =>
  ['synapse', 'cases', 'similar', tenantId, caseId] as const;

export const caseRagEvidenceQueryKey = (tenantId: string, caseId: string) =>
  ['synapse', 'cases', 'ragEvidence', tenantId, caseId] as const;

export const caseActionProposalsQueryKey = (tenantId: string, caseId: string, runId?: string | null) =>
  ['synapse', 'cases', 'action-proposals', tenantId, caseId, runId ?? ''] as const;

export const caseAnalysisRunsQueryKey = (tenantId: string, caseId: string, latest?: boolean) =>
  ['synapse', 'cases', 'analysis-runs', tenantId, caseId, latest ?? false] as const;

export const anomaliesListQueryKey = (
  tenantId: string,
  params?: AnomaliesListParams
) => ['synapse', 'anomalies', 'list', tenantId, params] as const;

export const actionsListQueryKey = (
  tenantId: string,
  params?: ActionsListParams
) => ['synapse', 'actions', 'list', tenantId, params] as const;

export const actionDetailQueryKey = (tenantId: string, actionId: string) =>
  ['synapse', 'actions', 'detail', tenantId, actionId] as const;

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

/**
 * 케이스 단위 감사 로그 조회 (감사 스트림 탭용)
 * GET /api/synapse/cases/{caseId}/audit-events
 */
export const useCaseAuditEventsQuery = (
  caseId: string | undefined,
  params?: CaseAuditEventsParams,
  options?: { enabled?: boolean }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled =
    (options?.enabled ?? true) &&
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(caseId);

  return useQuery({
    queryKey: caseAuditEventsQueryKey(tenantId, caseId ?? '', params),
    queryFn: async () => {
      if (!caseId) throw new Error('Missing case ID');
      const res = await getCaseAuditEvents(caseId, params ?? { page: 0, size: 20 });
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch case audit events');
      }
      return res.data;
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: false,
  });
};

export const useCaseAnalysisQuery = (
  caseId: string | undefined,
  options?: { enabled?: boolean; runId?: string | null }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const runId = options?.runId ?? null;
  const enabled =
    (options?.enabled ?? true) &&
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(caseId);

  return useQuery({
    queryKey: caseAnalysisQueryKey(tenantId, caseId ?? '', runId),
    queryFn: async () => {
      if (!caseId) throw new Error('Missing case ID');
      const res = await getCaseAnalysis(caseId, runId ? { runId } : undefined);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch case analysis');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useCaseAnalysisRunsQuery = (
  caseId: string | undefined,
  options?: { enabled?: boolean; latest?: boolean }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const latest = options?.latest ?? true;
  const enabled =
    (options?.enabled ?? true) &&
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(caseId);

  return useQuery({
    queryKey: caseAnalysisRunsQueryKey(tenantId, caseId ?? '', latest),
    queryFn: async () => {
      if (!caseId) throw new Error('Missing case ID');
      const res = await getAnalysisRuns(caseId, { latest });
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch analysis runs');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useCaseConfidenceQuery = (
  caseId: string | undefined,
  options?: { enabled?: boolean }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled =
    (options?.enabled ?? true) &&
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(caseId);

  return useQuery({
    queryKey: caseConfidenceQueryKey(tenantId, caseId ?? ''),
    queryFn: async () => {
      if (!caseId) throw new Error('Missing case ID');
      const res = await getCaseConfidence(caseId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch case confidence');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useCaseSimilarQuery = (
  caseId: string | undefined,
  options?: { enabled?: boolean }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled =
    (options?.enabled ?? true) &&
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(caseId);

  return useQuery({
    queryKey: caseSimilarQueryKey(tenantId, caseId ?? ''),
    queryFn: async () => {
      if (!caseId) throw new Error('Missing case ID');
      const res = await getCaseSimilar(caseId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch similar cases');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useCaseRagEvidenceQuery = (
  caseId: string | undefined,
  options?: { enabled?: boolean }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled =
    (options?.enabled ?? true) &&
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(caseId);

  return useQuery({
    queryKey: caseRagEvidenceQueryKey(tenantId, caseId ?? ''),
    queryFn: async () => {
      if (!caseId) throw new Error('Missing case ID');
      const res = await getCaseRagEvidence(caseId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch RAG evidence');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
      retry: false,
  });
};

export const useCaseActionProposalsQuery = (
  caseId: string | undefined,
  options?: { enabled?: boolean; runId?: string | null }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const runId = options?.runId ?? null;
  const enabled =
    (options?.enabled ?? true) &&
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(caseId);

  return useQuery({
    queryKey: caseActionProposalsQueryKey(tenantId, caseId ?? '', runId),
    queryFn: async () => {
      if (!caseId) throw new Error('Missing case ID');
      const res = await getCaseActionProposals(caseId, runId ? { runId } : undefined);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch action proposals');
      }
      const data = res.data;
      if (Array.isArray(data)) return data;
      const obj = data as { items?: unknown[]; content?: unknown[]; data?: unknown[] } | undefined;
      return obj?.items ?? obj?.content ?? obj?.data ?? [];
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useUpdateCaseStatusMutation = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      caseId,
      status,
    }: {
      caseId: string;
      status: 'OPEN' | 'TRIAGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
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
      const statusLabel = t(`statusLabels.${variables.status.toLowerCase()}`, {
        defaultValue: variables.status,
      });
      const message = t('toast.statusUpdatedWithAudit', { status: statusLabel });
      showToast(message, 'success', {
        label: t('toast.auditViewInLog'),
        href: buildAuditUrl({ resourceId: variables.caseId, range: '24h' }),
      });
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.failedToUpdateStatus'), 'error');
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
  const { t } = useTranslation('common');
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
      showToast(t('toast.actionCreated'));
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.failedToCreateAction'), 'error');
    },
  });
};

export const useApproveActionMutation = () => {
  const { t } = useTranslation('common');
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
    onSuccess: (_, actionId) => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'actions'] });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'archive'] });
      showToast(t('toast.approved'), 'success', {
        label: t('toast.auditViewInLog'),
        href: buildAuditUrl({ resourceId: actionId, range: '24h' }),
      });
    },
    onError: (err) => {
      showToastWithAuditLink(
        err instanceof Error ? err.message : t('toast.failedToApprove'),
        getAuditIdFromError(err)
      );
    },
  });
};

export const useExecuteActionMutation = () => {
  const { t } = useTranslation('common');
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
      showToast(t('toast.actionExecuted'));
    },
    onError: (err) => {
      showToastWithAuditLink(
        err instanceof Error ? err.message : t('toast.failedToExecute'),
        getAuditIdFromError(err)
      );
    },
  });
};

export const useRejectActionMutation = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const res = await rejectAction(actionId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to reject action');
      }
      return res.data;
    },
    onSuccess: (_, actionId) => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'actions'] });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      showToast(t('toast.actionRejected'), 'success', {
        label: t('toast.auditViewInLog'),
        href: buildAuditUrl({ resourceId: actionId, range: '24h' }),
      });
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.failedToReject'), 'error');
    },
  });
};

export const useApproveProposalMutation = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      caseId,
      proposalId,
      comment,
    }: {
      caseId: string;
      proposalId: string;
      comment?: string;
    }) => {
      const res = await submitActionProposalDecision(caseId, proposalId, {
        decision: 'APPROVE',
        ...(comment ? { comment } : {}),
      });
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to approve proposal');
      }
      return res.data;
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      queryClient.invalidateQueries({
        queryKey: caseActionProposalsQueryKey(tenantId, caseId),
      });
      queryClient.invalidateQueries({
        queryKey: caseAnalysisQueryKey(tenantId, caseId),
      });
      showToast(t('toast.approved'), 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.failedToApprove'), 'error');
    },
  });
};

export const useRejectProposalMutation = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      caseId,
      proposalId,
      comment,
    }: {
      caseId: string;
      proposalId: string;
      comment?: string;
    }) => {
      const res = await submitActionProposalDecision(caseId, proposalId, {
        decision: 'REJECT',
        ...(comment ? { comment } : {}),
      });
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to reject proposal');
      }
      return res.data;
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      queryClient.invalidateQueries({
        queryKey: caseActionProposalsQueryKey(tenantId, caseId),
      });
      queryClient.invalidateQueries({
        queryKey: caseAnalysisQueryKey(tenantId, caseId),
      });
      showToast(t('toast.actionRejected'), 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.failedToReject'), 'error');
    },
  });
};

/** BE(back.txt): POST .../action-proposals/{proposalId}/execute — APPROVED 제안만 호출 가능. Phase3: runId+simulate. */
export type ExecuteProposalVariables = {
  caseId: string;
  proposalId: string;
  runId?: string | null;
};

export const useExecuteProposalMutation = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({ caseId, proposalId, runId }: ExecuteProposalVariables) => {
      const res = await executeProposal(caseId, proposalId, {
        runId: runId ?? undefined,
        simulate: true,
      });
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        const msg =
          typeof res.message === 'string'
            ? res.message
            : res.data && typeof (res.data as { message?: string }).message === 'string'
              ? (res.data as { message?: string }).message
              : 'Failed to execute proposal';
        const stage = res.data && typeof (res.data as { stage?: string }).stage === 'string' ? (res.data as { stage?: string }).stage : undefined;
        const err = new Error(stage ? `${msg} (${stage})` : msg) as Error & { stage?: string };
        err.stage = stage;
        throw err;
      }
      return res.data;
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      queryClient.invalidateQueries({
        queryKey: caseActionProposalsQueryKey(tenantId, caseId),
      });
      queryClient.invalidateQueries({
        queryKey: caseAnalysisQueryKey(tenantId, caseId),
      });
      showToast(t('toast.actionExecuted'), 'success');
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : t('toast.failedToExecute');
      showToast(message, 'error');
    },
  });
};

export const useSimulateActionMutation = () => {
  const { t } = useTranslation('common');
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
      showToast(t('toast.simulationCompleted'));
    },
    onError: (err) => {
      showToastWithAuditLink(
        err instanceof Error ? err.message : t('toast.simulationFailed'),
        getAuditIdFromError(err)
      );
    },
  });
};

export const useActionDetailQuery = (actionId: string | null) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId) && Boolean(actionId);

  return useQuery({
    queryKey: actionDetailQueryKey(tenantId, actionId ?? ''),
    queryFn: async () => {
      if (!actionId) throw new Error('actionId required');
      const res = await getActionDetail(actionId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch action detail');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useResumeActionMutation = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const res = await resumeAction(actionId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        const err = new Error(res.message || 'Failed to resume action') as Error & { auditId?: string };
        err.auditId = res.auditId;
        throw err;
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'actions'] });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'archive'] });
      showToast(t('toast.actionExecuted'));
    },
    onError: (err) => {
      showToastWithAuditLink(
        err instanceof Error ? err.message : t('toast.failedToExecute'),
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
