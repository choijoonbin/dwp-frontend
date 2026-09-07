import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  canChangeWorkspaceWorkStatus,
  updateWorkspaceWorkStatuses,
} from '@dwp-frontend/shared-utils';

import {
  isConfirmedBatchResult,
  type WorkHubBatchOutcome,
  type WorkHubBatchTarget,
} from './work-hub-batch-dialog';
import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';
import type { WorkHubOperationFeedback } from './work-hub-page-helpers';

export function useWorkHubBatch({
  snapshot,
  checkedKeys,
  clearSelection,
  onFeedback,
  refresh,
}: {
  snapshot: WorkHubSnapshot | undefined;
  checkedKeys: ReadonlySet<string>;
  clearSelection: () => void;
  onFeedback: (feedback: WorkHubOperationFeedback) => void;
  refresh: () => Promise<unknown>;
}) {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<WorkHubBatchTarget | null>(null);
  const [reviewItems, setReviewItems] = useState<WorkHubItem[]>([]);
  const [outcome, setOutcome] = useState<WorkHubBatchOutcome | null>(null);
  const submitting = useRef(false);
  const items = useMemo(
    () => (snapshot?.items ?? []).filter((item) => checkedKeys.has(item.key) && item.legacyItem),
    [checkedKeys, snapshot?.items]
  );
  const mutation = useMutation({
    mutationFn: async (request: { target: WorkHubBatchTarget; items: WorkHubItem[] }) => {
      const legacyItems = request.items.map((item) => item.legacyItem!);
      if (
        !legacyItems.length ||
        legacyItems.length > 50 ||
        legacyItems.some((item) => !canChangeWorkspaceWorkStatus(item, request.target))
      ) {
        throw new Error('ineligible batch');
      }
      return updateWorkspaceWorkStatuses(
        legacyItems.map(({ workItemId, version }) => ({ workItemId, version })),
        request.target
      );
    },
    onSuccess: async (results, request) => {
      const confirmed = isConfirmedBatchResult(request.target, request.items, results);
      clearSelection();
      setOutcome(confirmed ? 'CONFIRMED' : 'UNKNOWN');
      onFeedback({
        severity: confirmed ? 'success' : 'warning',
        title: t(`workHub.batch.${confirmed ? 'successTitle' : 'unknownTitle'}`),
        detail: t(`workHub.batch.${confirmed ? 'successDetail' : 'unknownDetail'}`, {
          count: results.length,
        }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', 'activity'] }),
      ]);
    },
    onError: async () => {
      clearSelection();
      setOutcome('UNKNOWN');
      onFeedback({
        severity: 'warning',
        title: t('workHub.batch.unknownTitle'),
        detail: t('workHub.batch.unknownDetail'),
      });
      await refresh();
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  return {
    items,
    target,
    reviewItems,
    outcome,
    pending: mutation.isPending,
    open(nextTarget: WorkHubBatchTarget) {
      setReviewItems([...items]);
      setOutcome(null);
      setTarget(nextTarget);
    },
    close() {
      setTarget(null);
      setOutcome(null);
      setReviewItems([]);
    },
    confirm() {
      if (!target || submitting.current) return;
      submitting.current = true;
      mutation.mutate({ target, items: reviewItems });
    },
  };
}
