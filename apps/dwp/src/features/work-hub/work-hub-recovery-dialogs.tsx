import { useEffect, useRef, useState } from 'react';
import { WorkHubBatchDialog } from './work-hub-batch-dialog';
import { WorkHubSourceStatusDialog } from './work-hub-source-status-dialog';
import { isWorkHubSourceCommandReady } from './work-hub-command-authority';
import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';
import type { WorkHubItem, WorkHubSnapshot, WorkHubSourceId } from './work-hub-contracts';
import type { useWorkHubBatch } from './use-work-hub-batch';

export function currentWorkForBatchReview(
  snapshot: WorkHubSnapshot | null,
  reviewed: WorkHubItem
): WorkHubItem | null {
  if (!snapshot || snapshot.completeness === 'UNAVAILABLE') return null;
  const matches = snapshot.items.filter((candidate) => candidate.key === reviewed.key);
  const current = matches.length === 1 ? matches[0] : undefined;
  return current && isWorkHubSourceCommandReady(snapshot, current.sourceId) ? current : null;
}

export function WorkHubRecoveryDialogs({
  snapshot,
  sourceOpen,
  onCloseSources,
  retrying,
  refresh,
  refreshSource,
  batch,
  onOpenItem,
}: {
  snapshot: WorkHubSnapshot;
  sourceOpen: boolean;
  onCloseSources: () => void;
  retrying: boolean;
  refresh: () => Promise<WorkHubSnapshot | null>;
  refreshSource: (sourceId: WorkHubSourceId) => Promise<void>;
  batch: ReturnType<typeof useWorkHubBatch>;
  onOpenItem: (item: WorkHubItem) => void;
}) {
  const owner = useWorkHubOperationOwner();
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const mounted = useRef(false);
  const activeRead = useRef<object | null>(null);
  const [review, setReview] = useState<{
    owner: typeof owner;
    pending: boolean;
    unavailable: boolean;
  } | null>(null);
  const [batchExpanded, setBatchExpanded] = useState(false);
  const currentReview = review?.owner === owner ? review : null;
  useEffect(() => {
    setBatchExpanded(false);
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRead.current = null;
    };
  }, [owner]);
  useEffect(() => {
    if (batch.target && batch.outcome) setBatchExpanded(true);
  }, [batch.outcome, batch.target]);
  const reviewItem = async (item: WorkHubItem) => {
    if (!owner || activeRead.current || batch.pending) return;
    const run = {};
    activeRead.current = run;
    setReview({ owner, pending: true, unavailable: false });
    try {
      const fresh = await refresh();
      if (!mounted.current || ownerRef.current !== owner || activeRead.current !== run) return;
      const current = currentWorkForBatchReview(fresh, item);
      if (!current) {
        setReview({ owner, pending: false, unavailable: true });
        return;
      }
      batch.close();
      setBatchExpanded(false);
      if (sourceOpen) onCloseSources();
      onOpenItem(current);
      setReview(null);
    } catch {
      if (mounted.current && ownerRef.current === owner && activeRead.current === run)
        setReview({ owner, pending: false, unavailable: true });
    } finally {
      if (activeRead.current === run) activeRead.current = null;
    }
  };
  const integratedOpen = sourceOpen || batchExpanded;
  const closeIntegrated = () => {
    activeRead.current = null;
    setReview(null);
    setBatchExpanded(false);
    if (sourceOpen) onCloseSources();
    if (batch.target) batch.close();
  };
  return (
    <>
      <WorkHubSourceStatusDialog
        open={integratedOpen}
        sources={snapshot.sources}
        snapshotReceivedAt={snapshot.receivedAt}
        completeness={snapshot.completeness}
        onClose={closeIntegrated}
        onRetry={() => void refresh()}
        onRetrySource={(sourceId) => void refreshSource(sourceId)}
        retrying={retrying || batch.pending || Boolean(currentReview?.pending)}
        batchItems={batch.reviewItems}
        batchOutcome={batch.outcome}
        batchReceipts={batch.receipts}
        batchExpanded={batchExpanded}
        reportFocused={batchExpanded}
        onOpenBatchResults={() => {
          setReview(null);
          setBatchExpanded(true);
          batch.reopen();
          if (sourceOpen) onCloseSources();
        }}
        onRetryUnconfirmed={batch.retryUnconfirmed}
        onReviewItem={(item) => void reviewItem(item)}
        reviewUnavailable={currentReview?.unavailable}
      />
      <WorkHubBatchDialog
        target={batch.outcome ? null : batch.target}
        selectedCount={batch.reviewItems.length}
        items={batch.reviewItems}
        outcome={batch.outcome}
        busy={batch.pending || Boolean(currentReview?.pending)}
        onClose={() => {
          activeRead.current = null;
          setReview(null);
          batch.close();
        }}
        onConfirm={batch.confirm}
        receipts={batch.receipts}
        onRetryUnconfirmed={batch.retryUnconfirmed}
        onReviewItem={(item) => void reviewItem(item)}
        reviewUnavailable={currentReview?.unavailable}
      />
    </>
  );
}
