import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';
import {
  executeWorkHubBatch,
  type WorkHubBatchReceipt,
  type WorkHubBatchTarget,
} from './work-hub-batch-execution';
import type { WorkHubBatchOutcome } from './work-hub-batch-dialog';
import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';
import type { WorkHubOperationFeedback } from './work-hub-page-helpers';

type BatchRun = {
  owner: string;
  controller: AbortController;
  target: WorkHubBatchTarget;
  items: WorkHubItem[];
  previous: WorkHubBatchReceipt[];
};

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
  const owner = useWorkHubOperationOwner();
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const mounted = useRef(false);
  const activeRun = useRef<BatchRun | null>(null);
  const reviewOwner = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<WorkHubBatchTarget | null>(null);
  const [reviewItems, setReviewItems] = useState<WorkHubItem[]>([]);
  const [outcome, setOutcome] = useState<WorkHubBatchOutcome | null>(null);
  const [receipts, setReceipts] = useState<WorkHubBatchReceipt[]>([]);
  const lastTarget = useRef<WorkHubBatchTarget | null>(null);
  const submitting = useRef(false);
  const items = useMemo(
    () => (snapshot?.items ?? []).filter((item) => checkedKeys.has(item.key)),
    [checkedKeys, snapshot?.items]
  );
  const isCurrent = (run: BatchRun) =>
    mounted.current &&
    ownerRef.current === run.owner &&
    activeRun.current === run &&
    !run.controller.signal.aborted;

  useEffect(() => {
    mounted.current = true;
    // A new owner must review a new selection; previous receipts never cross sessions.
    activeRun.current?.controller.abort();
    activeRun.current = null;
    submitting.current = false;
    lastTarget.current = null;
    reviewOwner.current = null;
    setTarget(null);
    setReviewItems([]);
    setReceipts([]);
    setOutcome(null);
    return () => {
      mounted.current = false;
      activeRun.current?.controller.abort();
      activeRun.current = null;
    };
  }, [owner]);

  const mutation = useMutation({
    mutationFn: (request: BatchRun) =>
      executeWorkHubBatch(request.target, request.items, request.previous, undefined, {
        signal: request.controller.signal,
        canContinue: () => isCurrent(request),
      }),
    onSuccess: async (results, request) => {
      if (!isCurrent(request)) return;
      const confirmed = results.every((result) => result.state === 'CONFIRMED');
      setReceipts(results);
      setOutcome(confirmed ? 'CONFIRMED' : 'UNKNOWN');
      clearSelection();
      onFeedback({
        severity: confirmed ? 'success' : 'warning',
        title: t('workHub.batch.reportTitle'),
        detail: t('workHub.batch.reportSummary', {
          total: results.length,
          confirmed: results.filter((result) => result.state === 'CONFIRMED').length,
        }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', 'activity'] }),
      ]);
    },
    onError: async (_error, request) => {
      if (!isCurrent(request)) return;
      setOutcome('UNKNOWN');
      await refresh();
    },
    onSettled: (_data, _error, request) => {
      if (activeRun.current === request) {
        activeRun.current = null;
        submitting.current = false;
      }
    },
  });
  const submit = (retry: boolean) => {
    if (
      !target ||
      !owner ||
      ownerRef.current !== owner ||
      reviewOwner.current !== owner ||
      !mounted.current ||
      submitting.current
    )
      return;
    submitting.current = true;
    const request: BatchRun = {
      owner,
      controller: new AbortController(),
      target,
      items: reviewItems,
      previous: retry ? receipts : [],
    };
    activeRun.current = request;
    mutation.mutate(request);
  };
  return {
    items,
    target,
    reviewItems,
    outcome,
    receipts,
    pending: mutation.isPending && activeRun.current?.owner === owner,
    open(nextTarget: WorkHubBatchTarget) {
      if (!owner || submitting.current) return;
      reviewOwner.current = owner;
      setReviewItems([...items]);
      setReceipts([]);
      setOutcome(null);
      setTarget(nextTarget);
      lastTarget.current = nextTarget;
    },
    close() {
      if (!submitting.current) setTarget(null);
    },
    reopen() {
      if (receipts.length) setTarget(lastTarget.current);
    },
    confirm() {
      submit(false);
    },
    retryUnconfirmed() {
      submit(true);
    },
  };
}
