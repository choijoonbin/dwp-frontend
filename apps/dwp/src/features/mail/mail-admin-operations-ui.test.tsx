// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MailAdminOperationsContent } from './mail-admin-operations-ui';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type { MailDeliveryRecoveryEvidence } from './mail-admin-operations-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

const NOW = Date.parse('2026-09-16T06:00:00.000Z');

const overview: MailAdminOverview = {
  personalAccounts: 1,
  sharedAccounts: 0,
  activeConnections: 1,
  degradedConnections: 0,
  openSharedThreads: 0,
  pendingAiProposals: 0,
  queuedDeliveries: 0,
  failedDeliveries: 1,
  policy: {
    externalSenderBanner: true,
    blockRemoteImages: true,
    allowSharedInboxes: true,
    aiAssistanceEnabled: false,
    aiCrossAppActionsEnabled: false,
    aiAutoExecuteEnabled: false,
    retentionDays: 365,
    maximumAttachmentMb: 25,
    version: 1,
  },
  connections: [],
  sharedInboxes: [],
  providerCatalog: [],
  generatedAt: '2026-09-16T05:59:30.000Z',
};

function delivery(evidenceGeneratedAt: string): MailDeliveryRecoveryEvidence {
  return {
    deliveryId: 'delivery-1',
    state: 'FAILED',
    retryEligibility: 'ELIGIBLE',
    providerDisposition: 'NOT_ACCEPTED',
    idempotencyState: 'REPLAY_SAFE',
    reconcileCapability: true,
    evidenceGeneratedAt,
  };
}

describe('Mail admin delivery recovery controls', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('keeps retry disabled and offers reconciliation when recovery evidence is stale', async () => {
    const onReconcile = vi.fn();
    const onRetry = vi.fn();
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="delivery-audit"
          overview={overview}
          canManage
          now={NOW}
          deliveryEvidence={[delivery('2026-09-16T05:57:59.999Z')]}
          onReconcileDelivery={onReconcile}
          onRetryDelivery={onRetry}
        />
      )
    );

    const buttons = [...host.querySelectorAll('button')];
    const reconcile = buttons.find((button) => button.textContent?.includes('Reconcile'));
    const retry = buttons.find((button) => button.textContent?.includes('delivery.retry'));
    expect(host.textContent).toContain('RECOVERY_EVIDENCE_NOT_CURRENT');
    expect(reconcile?.disabled).toBe(false);
    expect(retry?.disabled).toBe(true);

    await act(async () => reconcile?.click());
    expect(onReconcile).toHaveBeenCalledWith('delivery-1');
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('enables retry only while recovery evidence is inside the freshness window', async () => {
    const onRetry = vi.fn();
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="delivery-audit"
          overview={overview}
          canManage
          now={NOW}
          deliveryEvidence={[delivery('2026-09-16T05:58:00.000Z')]}
          onRetryDelivery={onRetry}
        />
      )
    );

    const retry = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('delivery.retry')
    );
    expect(retry?.disabled).toBe(false);
    await act(async () => retry?.click());
    expect(onRetry).toHaveBeenCalledWith('delivery-1');
  });
});

describe('Mail administrative evidence surfaces', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('renders source freshness, safe exception references, and command correlations on A01', async () => {
    const onOpenException = vi.fn();
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="operations"
          overview={overview}
          canManage
          now={NOW}
          operations={{
            generatedAt: '2026-09-16T05:59:30.000Z',
            sources: [
              {
                sourceId: 'OUTBOX',
                state: 'STALE',
                observedAt: '2026-09-16T05:40:00.000Z',
                errorCode: 'COLLECTOR_TIMEOUT',
              },
            ],
            exceptions: [
              {
                exceptionId: 'exception-1',
                kind: 'DELIVERY',
                severity: 'CRITICAL',
                safeResourceRef: 'message:••42',
                impactCount: 1,
                lastObservedAt: '2026-09-16T05:59:00.000Z',
                correlationId: 'corr-exception-1',
                nextAction: 'OPEN_DELIVERY',
              },
            ],
            commands: [
              {
                auditId: 'audit-1',
                commandType: 'DELIVERY_RECONCILE',
                safeResourceRef: 'message:••42',
                actorName: 'Mail operator',
                result: 'UNKNOWN',
                occurredAt: '2026-09-16T05:58:00.000Z',
                correlationId: 'corr-command-1',
              },
            ],
          }}
          onOpenException={onOpenException}
        />
      )
    );

    expect(host.textContent).toContain('OUTBOX');
    expect(host.textContent).toContain('COLLECTOR_TIMEOUT');
    expect(host.textContent).toContain('message:••42');
    expect(host.textContent).toContain('corr-command-1');
    const open = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Open evidence')
    );
    await act(async () => open?.click());
    expect(onOpenException).toHaveBeenCalledWith(
      expect.objectContaining({ exceptionId: 'exception-1' })
    );
  });

  it('keeps purge execution disabled until the current snapshot has two approvals', async () => {
    const onExecute = vi.fn();
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="retention"
          overview={overview}
          canManage
          now={NOW}
          retention={{
            generatedAt: '2026-09-16T05:59:30.000Z',
            policyVersion: 1,
            resourcePolicies: [],
            holds: [],
            purgeJobs: [],
            candidate: {
              candidateSnapshotId: 'snapshot-1',
              fingerprint: 'sha256:one',
              totalCandidates: 4,
              heldCount: 0,
              eligibleCount: 4,
              partialSources: [],
              generatedAt: '2026-09-16T05:59:30.000Z',
              expiresAt: '2026-09-16T06:10:00.000Z',
              policyVersion: 1,
              distinctApproverCount: 1,
            },
          }}
          onExecutePurge={onExecute}
        />
      )
    );

    const execute = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Execute purge')
    );
    expect(execute?.disabled).toBe(true);
    expect(onExecute).not.toHaveBeenCalled();
  });
});
