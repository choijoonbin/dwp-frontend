/**
 * Case Detail HITL 승인/반려 — 백엔드(Spring Boot) API 경유
 * 승인 시: 대시보드 KPI, 워크벤치 이력 탭 갱신을 위한 invalidateQueries.
 */

import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  showToast,
  getTenantId,
  rejectHitlRequest,
  approveHitlRequest,
  caseAuditEventsQueryKey,
  synapseDashboardSummaryQueryKey,
} from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

export type HitlStatus = 'pending_approval' | 'approved' | 'rejected' | 'executing' | 'succeeded' | 'failed';

export type ApprovePayload = { requestId: string; caseId?: string; /** 승인 사유 — 백엔드 Payload 포함 */ comment?: string };

export const useCaseHitl = (options?: {
  onApproved?: (requestId: string) => void;
  onRejected?: (requestId: string) => void;
}) => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (payload: ApprovePayload | string) => {
      const requestId = typeof payload === 'string' ? payload : payload.requestId;
      const comment = typeof payload === 'string' ? undefined : payload.comment;
      const result = await approveHitlRequest(requestId, { comment });
      return { result, caseId: typeof payload === 'string' ? undefined : payload.caseId };
    },
    onSuccess: (_, payload) => {
      const requestId = typeof payload === 'string' ? payload : payload.requestId;
      const caseId = typeof payload === 'string' ? undefined : payload.caseId;
      const tenantId = getTenantId();
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: synapseDashboardSummaryQueryKey(tenantId) });
        if (caseId) {
          queryClient.invalidateQueries({
            queryKey: caseAuditEventsQueryKey(tenantId, caseId),
          });
        }
      }
      if (caseId) {
        queryClient.setQueriesData<{ items?: Array<{ caseId?: string; status?: string }>; content?: Array<{ caseId?: string; status?: string }>; data?: Array<{ caseId?: string; status?: string }> }>(
          { queryKey: ['synapse', 'cases', 'list'] },
          (old) => {
            if (!old) return old;
            const list = old.items ?? old.content ?? old.data ?? [];
            const next = list.map((row) =>
              String(row.caseId) === String(caseId) ? { ...row, status: 'RESOLVED' } : row
            );
            if (old.items) return { ...old, items: next };
            if (old.content) return { ...old, content: next };
            if (old.data) return { ...old, data: next };
            return old;
          }
        );
      }
      showToast(t('toast.approved'));
      options?.onApproved?.(requestId);
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.approvalFailed'), 'error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const result = await rejectHitlRequest(requestId, reason);
      return result;
    },
    onSuccess: (_, { requestId }) => {
      const tenantId = getTenantId();
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: synapseDashboardSummaryQueryKey(tenantId) });
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'synapse' &&
            query.queryKey[1] === 'cases' &&
            query.queryKey[2] === 'audit-events',
        });
      }
      showToast(t('toast.rejected'));
      options?.onRejected?.(requestId);
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.rejectionFailed'), 'error');
    },
  });

  return {
    approve: (requestIdOrPayload: string | ApprovePayload) =>
      approveMutation.mutate(typeof requestIdOrPayload === 'string' ? requestIdOrPayload : requestIdOrPayload),
    reject: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
};
