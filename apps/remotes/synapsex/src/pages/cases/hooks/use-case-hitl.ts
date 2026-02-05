/**
 * Case Detail HITL 승인/반려 mutation
 * approveHitlRequest, rejectHitlRequest 래핑
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import { showToast, rejectHitlRequest, approveHitlRequest } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

export type HitlStatus = 'pending_approval' | 'approved' | 'rejected' | 'executing' | 'succeeded' | 'failed';

export const useCaseHitl = (options?: {
  onApproved?: (requestId: string) => void;
  onRejected?: (requestId: string) => void;
}) => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const result = await approveHitlRequest(requestId);
      return result;
    },
    onSuccess: (_, requestId) => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
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
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      showToast(t('toast.rejected'));
      options?.onRejected?.(requestId);
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.rejectionFailed'), 'error');
    },
  });

  return {
    approve: approveMutation.mutate,
    reject: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
};
