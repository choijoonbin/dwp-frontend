import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';
import {
  canRetryWorkHubBatchReceipt,
  executeWorkHubBatch,
  workHubBatchReviewedCommand,
  type WorkHubBatchReceipt,
  type WorkHubBatchTarget,
} from './work-hub-batch-execution';
import {
  clearWorkHubBatchReport,
  finalizeWorkHubBatchReport,
  persistWorkHubBatchReport,
  restoreWorkHubBatchReport,
  WORK_HUB_BATCH_REPORT_UPDATED_EVENT,
} from './work-hub-batch-receipt-storage';
import type { WorkHubBatchOutcome } from './work-hub-batch-dialog';
import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';
import type { WorkHubOperationFeedback } from './work-hub-page-helpers';
import {
  canUseWorkHubGenericAdjunct,
  isWorkHubItemCommandReady,
  isWorkHubSourceCommandReady,
} from './work-hub-command-authority';

type BatchRun = {
  owner: string;
  controller: AbortController;
  runId: string;
  snapshot: WorkHubSnapshot;
  sourceSettled: boolean;
  retry: boolean;
  target: WorkHubBatchTarget;
  items: WorkHubItem[];
  previous: WorkHubBatchReceipt[];
  prepared: WorkHubBatchReceipt[];
};

function batchReviewIsReady(
  candidate: WorkHubSnapshot | null | undefined,
  reviewedItems: readonly WorkHubItem[],
  reviewedTarget: WorkHubBatchTarget,
  previous: readonly WorkHubBatchReceipt[]
) {
  if (!candidate || candidate.completeness === 'UNAVAILABLE') return false;
  const previousByItem = new Map(previous.map((receipt) => [receipt.item.key, receipt]));
  return reviewedItems.every((reviewed) => {
    const prior = previousByItem.get(reviewed.key);
    if (prior && !canRetryWorkHubBatchReceipt(prior)) return true;
    const current = candidate.items.find((item) => item.key === reviewed.key);
    if (!current || !isWorkHubSourceCommandReady(candidate, current.sourceId)) return false;
    if (prior) return true;
    if (!isWorkHubItemCommandReady(candidate, reviewed)) return false;
    const expected = workHubBatchReviewedCommand(reviewed, reviewedTarget);
    const actual = workHubBatchReviewedCommand(current, reviewedTarget);
    return (
      expected.kind === actual.kind &&
      expected.lifecycle === actual.lifecycle &&
      expected.version === actual.version
    );
  });
}

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
  /** Returns the newly read aggregate snapshot used as the dispatch preflight. */
  refresh: () => Promise<WorkHubSnapshot | null>;
}) {
  const { t } = useTranslation('work');
  const owner = useWorkHubOperationOwner();
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const checkedKeysRef = useRef(checkedKeys);
  checkedKeysRef.current = checkedKeys;
  const mounted = useRef(false);
  const activeRun = useRef<BatchRun | null>(null);
  const reviewOwner = useRef<string | null>(null);
  const restoredReportOwner = useRef<string | null>(null);
  const restoredSnapshot = useRef<WorkHubSnapshot | undefined>(undefined);
  const reviewedSnapshot = useRef<WorkHubSnapshot | undefined>(undefined);
  const restoreGeneration = useRef(0);
  const restoreRequest = useRef<object | null>(null);
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<WorkHubBatchTarget | null>(null);
  const [reviewItems, setReviewItems] = useState<WorkHubItem[]>([]);
  const [outcome, setOutcome] = useState<WorkHubBatchOutcome | null>(null);
  const [receipts, setReceipts] = useState<WorkHubBatchReceipt[]>([]);
  const [restoreRevision, setRestoreRevision] = useState(0);
  const lastTarget = useRef<WorkHubBatchTarget | null>(null);
  const submitting = useRef(false);
  const items = useMemo(
    () =>
      (snapshot?.items ?? []).filter(
        (item) =>
          checkedKeys.has(item.key) &&
          canUseWorkHubGenericAdjunct(item, 'BATCH') &&
          isWorkHubItemCommandReady(snapshot, item)
      ),
    [checkedKeys, snapshot]
  );
  const isCurrent = (run: BatchRun) =>
    mounted.current &&
    ownerRef.current === run.owner &&
    activeRun.current === run &&
    !run.controller.signal.aborted &&
    batchReviewIsReady(snapshotRef.current, run.items, run.target, run.previous);
  const canPublish = (run: BatchRun) =>
    mounted.current &&
    ownerRef.current === run.owner &&
    activeRun.current === run &&
    run.sourceSettled;

  useEffect(() => {
    mounted.current = true;
    // A new owner must review a new selection; previous receipts never cross sessions.
    restoreGeneration.current += 1;
    restoredReportOwner.current = null;
    restoredSnapshot.current = undefined;
    reviewedSnapshot.current = undefined;
    restoreRequest.current = null;
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

  useEffect(() => {
    const run = activeRun.current;
    if (
      run &&
      !run.sourceSettled &&
      !batchReviewIsReady(snapshot, run.items, run.target, run.previous)
    ) {
      run.controller.abort();
    }
  }, [snapshot]);

  useEffect(() => {
    const restoreLatest = () => {
      restoreGeneration.current += 1;
      restoreRequest.current = null;
      setRestoreRevision((value) => value + 1);
    };
    globalThis.addEventListener?.(WORK_HUB_BATCH_REPORT_UPDATED_EVENT, restoreLatest);
    return () =>
      globalThis.removeEventListener?.(WORK_HUB_BATCH_REPORT_UPDATED_EVENT, restoreLatest);
  }, []);

  useEffect(() => {
    if (!owner || !snapshot || restoreRequest.current || activeRun.current) return;
    if (restoredReportOwner.current === owner) {
      restoredReportOwner.current = null;
      restoredSnapshot.current = undefined;
      reviewOwner.current = null;
      lastTarget.current = null;
      setTarget(null);
      setReviewItems([]);
      setReceipts([]);
      setOutcome(null);
    }
    const generation = restoreGeneration.current;
    const request = {};
    restoreRequest.current = request;
    void restoreWorkHubBatchReport(
      owner,
      snapshot.items,
      window.sessionStorage,
      Date.now(),
      snapshot.completeness === 'COMPLETE'
    ).then((report) => {
      if (
        !mounted.current ||
        ownerRef.current !== owner ||
        restoreGeneration.current !== generation ||
        restoreRequest.current !== request
      )
        return;
      restoreRequest.current = null;
      if (!report) return;
      restoredReportOwner.current = owner;
      restoredSnapshot.current = snapshot;
      reviewedSnapshot.current = snapshot;
      reviewOwner.current = owner;
      lastTarget.current = report.target;
      setReviewItems(report.receipts.map((receipt) => receipt.item));
      setReceipts(report.receipts);
      setOutcome(
        report.receipts.every((receipt) => receipt.state === 'CONFIRMED') ? 'CONFIRMED' : 'UNKNOWN'
      );
    });
    return () => {
      if (restoreRequest.current === request) restoreRequest.current = null;
    };
  }, [owner, restoreRevision, snapshot]);

  const mutation = useMutation({
    mutationFn: async (request: BatchRun) => {
      if (!isCurrent(request)) throw new DOMException('Work snapshot changed', 'AbortError');
      const results = await executeWorkHubBatch(
        request.target,
        request.items,
        request.previous,
        undefined,
        {
          signal: request.controller.signal,
          canContinue: () => isCurrent(request),
          idempotencyKeys: new Map(
            request.prepared.map((receipt) => [receipt.item.key, receipt.idempotencyKey])
          ),
          reviewedCommands: new Map(
            request.prepared.map((receipt) => [receipt.item.key, receipt.reviewedCommand])
          ),
        }
      );
      request.sourceSettled = true;
      await finalizeWorkHubBatchReport(
        request.owner,
        request.target,
        request.runId,
        request.prepared,
        results
      );
      if (ownerRef.current === request.owner)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] }),
          queryClient.invalidateQueries({ queryKey: ['workspace', 'activity'] }),
        ]);
      return results;
    },
    onSuccess: async (results, request) => {
      if (!canPublish(request)) return;
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
        if (mounted.current && ownerRef.current === request.owner) {
          restoreGeneration.current += 1;
          restoreRequest.current = null;
          setRestoreRevision((value) => value + 1);
        }
      }
    },
  });
  const submit = async (retry: boolean) => {
    const currentSnapshot = snapshotRef.current;
    if (
      !target ||
      !owner ||
      ownerRef.current !== owner ||
      reviewOwner.current !== owner ||
      !currentSnapshot ||
      !batchReviewIsReady(currentSnapshot, reviewItems, target, retry ? receipts : []) ||
      !mounted.current ||
      submitting.current
    )
      return false;
    submitting.current = true;
    let commandSnapshot: WorkHubSnapshot | null = null;
    try {
      commandSnapshot = await refresh();
    } catch {
      commandSnapshot = null;
    }
    if (
      !mounted.current ||
      ownerRef.current !== owner ||
      !commandSnapshot ||
      !batchReviewIsReady(commandSnapshot, reviewItems, target, retry ? receipts : [])
    ) {
      submitting.current = false;
      if (mounted.current && ownerRef.current === owner) {
        onFeedback({
          severity: 'error',
          title: t('workHub.results.UNAVAILABLE.title'),
          detail: t('workHub.results.UNAVAILABLE.detail'),
        });
      }
      return false;
    }
    const verifiedSnapshot = commandSnapshot;
    const previous = retry ? receipts : [];
    const priorByItem = new Map(previous.map((receipt) => [receipt.item.key, receipt]));
    const prepared = reviewItems.map<WorkHubBatchReceipt>((item) => {
      const prior = priorByItem.get(item.key);
      if (prior) return prior;
      const reviewedCommand = workHubBatchReviewedCommand(item, target);
      return {
        item,
        idempotencyKey: crypto.randomUUID(),
        reviewedCommand,
        state: reviewedCommand.kind === null ? 'EXCLUDED' : 'UNKNOWN',
      };
    });
    const request: BatchRun = {
      owner,
      controller: new AbortController(),
      runId: crypto.randomUUID(),
      snapshot: verifiedSnapshot,
      sourceSettled: false,
      retry,
      target,
      items: reviewItems,
      previous,
      prepared,
    };
    activeRun.current = request;
    const persisted = await persistWorkHubBatchReport(
      owner,
      target,
      request.runId,
      prepared,
      window.sessionStorage,
      Date.now(),
      () => isCurrent(request)
    );
    if (persisted && !isCurrent(request)) {
      const cancelled = await executeWorkHubBatch(
        request.target,
        request.items,
        request.previous,
        undefined,
        {
          signal: request.controller.signal,
          canContinue: () => false,
          idempotencyKeys: new Map(
            request.prepared.map((receipt) => [receipt.item.key, receipt.idempotencyKey])
          ),
          reviewedCommands: new Map(
            request.prepared.map((receipt) => [receipt.item.key, receipt.reviewedCommand])
          ),
        }
      );
      await finalizeWorkHubBatchReport(
        request.owner,
        request.target,
        request.runId,
        request.prepared,
        cancelled
      );
    }
    if (!persisted || !isCurrent(request)) {
      if (activeRun.current === request) {
        activeRun.current = null;
        submitting.current = false;
      }
      if (!persisted && mounted.current && ownerRef.current === owner) {
        onFeedback({
          severity: 'error',
          title: t('workHub.results.UNAVAILABLE.title'),
          detail: t('workHub.results.UNAVAILABLE.detail'),
        });
      }
      return false;
    }
    mutation.mutate(request);
    return true;
  };
  const ownsReview = Boolean(
    owner &&
    reviewOwner.current === owner &&
    snapshot &&
    batchReviewIsReady(snapshot, reviewItems, lastTarget.current ?? 'COMPLETED', receipts) &&
    (activeRun.current?.owner === owner ||
      restoredReportOwner.current !== owner ||
      restoredSnapshot.current === snapshot)
  );
  return {
    items,
    target: ownsReview ? target : null,
    reviewItems: ownsReview ? reviewItems : [],
    outcome: ownsReview ? outcome : null,
    receipts: ownsReview ? receipts : [],
    pending: mutation.isPending && activeRun.current?.owner === owner,
    open(nextTarget: WorkHubBatchTarget) {
      const currentOwner = ownerRef.current;
      const currentSnapshot = snapshotRef.current;
      if (!currentOwner || !currentSnapshot || !items.length || submitting.current) return;
      restoreGeneration.current += 1;
      clearWorkHubBatchReport();
      restoredReportOwner.current = null;
      restoredSnapshot.current = undefined;
      reviewedSnapshot.current = currentSnapshot;
      reviewOwner.current = currentOwner;
      setReviewItems(currentSnapshot.items.filter((item) => checkedKeysRef.current.has(item.key)));
      setReceipts([]);
      setOutcome(null);
      setTarget(nextTarget);
      lastTarget.current = nextTarget;
    },
    close() {
      if (!submitting.current) setTarget(null);
    },
    reopen() {
      if (ownsReview && receipts.length) setTarget(lastTarget.current);
    },
    confirm() {
      return submit(false);
    },
    retryUnconfirmed() {
      return submit(true);
    },
  };
}
