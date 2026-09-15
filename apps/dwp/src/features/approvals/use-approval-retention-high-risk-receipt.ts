import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { ApprovalHighRiskCommandController } from './use-approval-high-risk-command';
import type { RetentionReceiptAttempt } from './approval-retention-receipt-owner';

export type ApprovalRetentionHighRiskReceiptTracker = Readonly<{
  current: () => RetentionReceiptAttempt | null;
  stage: (attempt: RetentionReceiptAttempt) => void;
  markDispatched: () => void;
  clear: () => void;
  settleScopeReset: () => void;
  settleUnknown: () => void;
}>;

export function useApprovalRetentionHighRiskReceiptTracker(
  preserve: (attempt: RetentionReceiptAttempt) => void
): ApprovalRetentionHighRiskReceiptTracker {
  const pending = useRef<RetentionReceiptAttempt | null>(null);
  const dispatched = useRef(false);
  const current = useCallback(() => pending.current, []);
  const stage = useCallback((attempt: RetentionReceiptAttempt) => {
    pending.current = attempt;
    dispatched.current = false;
  }, []);
  const markDispatched = useCallback(() => {
    if (!pending.current) throw new Error('Retention HIGH command witness is unavailable');
    dispatched.current = true;
  }, []);
  const clear = useCallback(() => {
    pending.current = null;
    dispatched.current = false;
  }, []);
  const preserveDispatched = useCallback(() => {
    const attempt = pending.current;
    if (attempt && dispatched.current) preserve(attempt);
    clear();
  }, [clear, preserve]);
  return useMemo(
    () => ({
      current,
      stage,
      markDispatched,
      clear,
      settleScopeReset: preserveDispatched,
      settleUnknown: preserveDispatched,
    }),
    [clear, current, markDispatched, preserveDispatched, stage]
  );
}

export function useApprovalRetentionHighRiskReceiptRecovery(
  controller: ApprovalHighRiskCommandController,
  tracker: ApprovalRetentionHighRiskReceiptTracker
) {
  const { close, error } = controller;
  useEffect(() => {
    if (error === 'command-retry' || error === 'command-uncertain') {
      tracker.settleUnknown();
      close();
      return;
    }
    if (
      error === 'command-rejected' ||
      error === 'authority-unavailable' ||
      error === 'revision-conflict'
    )
      tracker.clear();
  }, [close, error, tracker]);
}
