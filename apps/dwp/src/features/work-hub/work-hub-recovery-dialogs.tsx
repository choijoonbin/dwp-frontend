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
  const currentReview = review?.owner === owner ? review : null;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRead.current = null;
    };
  }, [owner]);
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
      onOpenItem(current);
      setReview(null);
    } catch {
      if (mounted.current && ownerRef.current === owner && activeRead.current === run)
        setReview({ owner, pending: false, unavailable: true });
    } finally {
      if (activeRead.current === run) activeRead.current = null;
    }
  };
  return (
    <>
      <WorkHubSourceStatusDialog
        open={sourceOpen}
        sources={snapshot.sources}
        onClose={onCloseSources}
        onRetry={() => void refresh()}
        onRetrySource={(sourceId) => void refreshSource(sourceId)}
        retrying={retrying}
        batchResultCount={batch.receipts.length}
        onOpenBatchResults={() => {
          onCloseSources();
          setReview(null);
          batch.reopen();
        }}
      />
      <WorkHubBatchDialog
        target={batch.target}
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
