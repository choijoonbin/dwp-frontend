// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planningAuthorityFixture } from '@dwp-frontend/shared-utils/test-utils/approval-workflow-planning-fixtures';
import { prepareApprovalRetentionReceiptOriginal } from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import {
  useApprovalRetentionHighRiskReceiptRecovery,
  useApprovalRetentionHighRiskReceiptTracker,
} from './use-approval-retention-high-risk-receipt';

import type { ApprovalHighRiskCommandController } from './use-approval-high-risk-command';
import type { RetentionReceiptAttempt } from './approval-retention-receipt-owner';
import type { ApprovalRetentionHighRiskReceiptTracker } from './use-approval-retention-high-risk-receipt';

function controller(
  error: ApprovalHighRiskCommandController['error'],
  close: () => void
): ApprovalHighRiskCommandController {
  return {
    open: true,
    busy: false,
    attempt: null,
    error,
    close,
    confirm: async () => undefined,
    continueWithIdentityProvider: () => undefined,
    selectIdentityProvider: async () => undefined,
  };
}

describe('retention HIGH receipt dispatch ownership', () => {
  let root: Root;
  let container: HTMLDivElement;
  let attempt: RetentionReceiptAttempt;
  let tracker: ApprovalRetentionHighRiskReceiptTracker;
  const preserve = vi.fn<(value: RetentionReceiptAttempt) => void>();
  const close = vi.fn<() => void>();

  beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
    preserve.mockClear();
    close.mockClear();
    attempt = {
      original: await prepareApprovalRetentionReceiptOriginal(
        {
          operation: 'INITIALIZE_POLICY',
          originalTargetId: null,
          body: { expectedAbsent: true, idempotencyKey: 'initialize:high-original' },
        },
        99,
        'RS_APPROVAL_FINANCE'
      ),
      binding: { scopeIdentity: 'retention-high', scopeEpoch: 3 },
      authoritySnapshot: planningAuthorityFixture().source.snapshot!,
      identityFingerprint: 'retention-high-authority',
      source: { kind: 'ABSENT_POLICY' },
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function Harness({ error }: { error: ApprovalHighRiskCommandController['error'] }) {
    tracker = useApprovalRetentionHighRiskReceiptTracker(preserve);
    useApprovalRetentionHighRiskReceiptRecovery(controller(error, close), tracker);
    return null;
  }

  const render = (error: ApprovalHighRiskCommandController['error'] = null) =>
    act(() => root.render(<Harness error={error} />));

  it('preserves only an actually dispatched UNKNOWN command and closes generic recovery', () => {
    render();
    act(() => tracker.stage(attempt));
    render('command-uncertain');
    expect(preserve).not.toHaveBeenCalled();
    expect(tracker.current()).toBeNull();

    render();
    act(() => {
      tracker.stage(attempt);
      tracker.markDispatched();
    });
    render('command-retry');
    expect(preserve).toHaveBeenCalledTimes(1);
    expect(preserve).toHaveBeenCalledWith(attempt);
    expect(tracker.current()).toBeNull();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('preserves dispatched work on scope reset but clears a pre-dispatch attempt', () => {
    render();
    act(() => {
      tracker.stage(attempt);
      tracker.settleScopeReset();
    });
    expect(preserve).not.toHaveBeenCalled();
    act(() => {
      tracker.stage(attempt);
      tracker.markDispatched();
      tracker.settleScopeReset();
    });
    expect(preserve).toHaveBeenCalledWith(attempt);
    expect(tracker.current()).toBeNull();
  });

  it('clears a deterministic rejection without creating an UNKNOWN receipt attempt', () => {
    render();
    act(() => {
      tracker.stage(attempt);
      tracker.markDispatched();
    });
    render('command-rejected');
    expect(preserve).not.toHaveBeenCalled();
    expect(tracker.current()).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
});
