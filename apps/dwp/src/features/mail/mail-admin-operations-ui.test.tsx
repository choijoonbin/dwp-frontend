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
    expect(host.textContent).toContain(
      'Refresh recovery evidence before deciding whether to retry.'
    );
    expect(host.textContent).not.toContain('RECOVERY_EVIDENCE_NOT_CURRENT');
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

  it('does not let a broad legacy flag bypass connection, shared-inbox, or policy permissions', async () => {
    const connectionOverview: MailAdminOverview = {
      ...overview,
      connections: [
        {
          connectionId: 'connection-1',
          connectionKey: 'primary',
          displayName: 'Primary mail',
          providerType: 'DWP_SANDBOX',
          authenticationMode: 'INTERNAL',
          state: 'CONFIGURATION_REQUIRED',
          capabilities: ['SEND'],
          credentialConfigured: false,
          version: 1,
        },
      ],
    };
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="connections"
          overview={connectionOverview}
          canManage
          canManageConnections={false}
          onOpenConnectionSettings={vi.fn()}
        />
      )
    );
    expect(
      [...host.querySelectorAll('button')].find(
        (button) => button.textContent === 'admin.connections.configure'
      )?.disabled
    ).toBe(true);

    const sharedOverview: MailAdminOverview = {
      ...overview,
      sharedAccounts: 1,
      sharedInboxes: [
        {
          sharedInboxId: 'shared-1',
          inboxKey: 'support',
          displayName: 'Support',
          address: 'support@example.com',
          serviceTargetMinutes: 120,
          lifecycleState: 'ACTIVE',
          openCount: 0,
          overdueCount: 0,
          version: 1,
        },
      ],
    };
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="shared-access"
          overview={sharedOverview}
          canManage
          canManageSharedInboxes={false}
          sharedAccess={[
            {
              sharedInboxId: 'shared-1',
              version: 1,
              providerState: 'APPLIED',
              members: [],
            },
          ]}
          onOpenSharedInboxSettings={vi.fn()}
          onAddSharedMember={vi.fn()}
        />
      )
    );
    const sharedButtons = [...host.querySelectorAll('button')];
    expect(
      sharedButtons.find((button) => button.textContent === 'admin.shared.configure')?.disabled
    ).toBe(true);
    expect(sharedButtons.find((button) => button.textContent === 'Add member')?.disabled).toBe(
      true
    );

    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="governance"
          overview={overview}
          canManage
          canManagePolicy={false}
          onOpenPolicySettings={vi.fn()}
        />
      )
    );
    expect(
      [...host.querySelectorAll('button')].find(
        (button) => button.textContent === 'admin.shared.configure'
      )?.disabled
    ).toBe(true);
  });

  it('separates hold, purge authorization, purge execution, and delivery recovery permissions', async () => {
    const retention = {
      generatedAt: '2026-09-16T05:59:30.000Z',
      policyVersion: 1,
      resourcePolicies: [],
      holds: [],
      purgeJobs: [],
      candidate: {
        candidateSnapshotId: 'snapshot-ready',
        fingerprint: 'sha256:ready',
        totalCandidates: 4,
        heldCount: 0,
        eligibleCount: 4,
        partialSources: [],
        generatedAt: '2026-09-16T05:59:30.000Z',
        expiresAt: '2026-09-16T06:10:00.000Z',
        policyVersion: 1,
        distinctApproverCount: 2,
      },
    };
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="retention"
          overview={overview}
          canManage={false}
          canManageHolds
          canAuthorizePurge={false}
          canExecutePurge
          now={NOW}
          retention={retention}
          onCreateLegalHold={vi.fn()}
          onPreviewPurge={vi.fn()}
          onApprovePurge={vi.fn()}
          onExecutePurge={vi.fn()}
        />
      )
    );
    const retentionButtons = [...host.querySelectorAll('button')];
    expect(
      retentionButtons.find((button) => button.textContent === 'Create legal hold')?.disabled
    ).toBe(false);
    expect(
      retentionButtons.find((button) => button.textContent === 'Preview purge')?.disabled
    ).toBe(true);
    expect(
      retentionButtons.find((button) => button.textContent === 'Approve snapshot')?.disabled
    ).toBe(true);
    expect(
      retentionButtons.find((button) => button.textContent === 'Execute purge')?.disabled
    ).toBe(false);

    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="delivery-audit"
          overview={overview}
          canManage={false}
          canReadAudit
          canRecoverDeliveries
          canExportAudit={false}
          now={NOW}
          deliveryEvidence={[delivery('2026-09-16T05:59:30.000Z')]}
          onRetryDelivery={vi.fn()}
          onExportDeliveryAudit={vi.fn()}
        />
      )
    );
    const deliveryButtons = [...host.querySelectorAll('button')];
    expect(
      deliveryButtons.find((button) => button.textContent?.includes('delivery.retry'))?.disabled
    ).toBe(false);
    expect(
      deliveryButtons.find((button) => button.textContent === 'Export evidence')?.disabled
    ).toBe(true);
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

  it('uses the member version when confirming shared-inbox access revocation', async () => {
    const onRemove = vi.fn();
    const sharedOverview: MailAdminOverview = {
      ...overview,
      sharedAccounts: 1,
      sharedInboxes: [
        {
          sharedInboxId: 'shared-1',
          inboxKey: 'people-help',
          displayName: 'People Help',
          address: 'people-help@example.com',
          purpose: 'Shared support',
          serviceTargetMinutes: 120,
          lifecycleState: 'ACTIVE',
          openCount: 2,
          overdueCount: 0,
          version: 12,
        },
      ],
    };
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="shared-access"
          overview={sharedOverview}
          canManage
          sharedAccess={[
            {
              sharedInboxId: 'shared-1',
              version: 12,
              providerState: 'APPLIED',
              members: [
                {
                  memberId: 'member-1',
                  userId: 42,
                  displayName: 'Mail member',
                  state: 'ACTIVE',
                  permissions: {
                    read: true,
                    sendAs: false,
                    sendOnBehalf: false,
                    assign: false,
                    manage: false,
                  },
                  providerState: 'APPLIED',
                  version: 7,
                },
              ],
            },
          ]}
          onRemoveSharedMember={onRemove}
        />
      )
    );

    const revoke = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Revoke'
    );
    await act(async () => revoke?.click());
    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm revocation'
    );
    await act(async () => confirm?.click());

    expect(onRemove).toHaveBeenCalledWith(
      'shared-1',
      expect.objectContaining({ memberId: 'member-1', version: 7 }),
      7
    );
  });

  it('renders translated delivery stages and sources without raw technical identifiers', async () => {
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="delivery-audit"
          overview={overview}
          canManage
          now={NOW}
          deliveryAudit={{
            total: 1,
            page: 0,
            pageSize: 50,
            generatedAt: '2026-09-16T05:59:30.000Z',
            items: [
              {
                deliveryId: 'delivery-1',
                safeResourceRef: 'message:••42',
                commandType: 'SEND',
                actorName: 'Mail administrator',
                accountName: 'People Help',
                providerType: 'DWP_SANDBOX',
                stage: 'ACCEPTED_BY_PROVIDER',
                state: 'ACCEPTED_BY_PROVIDER',
                retryEligibility: 'INELIGIBLE',
                providerDisposition: 'ACCEPTED',
                idempotencyState: 'UNKNOWN',
                reconcileCapability: false,
                cancelCapability: false,
                evidenceGeneratedAt: '2026-09-16T05:59:30.000Z',
                lastEvidenceAt: '2026-09-16T05:59:30.000Z',
                correlationId: 'corr-safe-1',
                version: 2,
                timeline: [
                  {
                    stage: 'PROVIDER_ACCEPTED',
                    state: 'SUCCEEDED',
                    at: '2026-09-16T05:59:30.000Z',
                    source: 'DWP_OUTBOX',
                    evidenceState: 'VERIFIED',
                  },
                ],
              },
            ],
          }}
        />
      )
    );

    expect(host.textContent).toContain('Accepted by the mail provider');
    expect(host.textContent).not.toContain('ACCEPTED_BY_PROVIDER');
    expect(host.textContent).not.toContain('DWP_SANDBOX');
    const timeline = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Timeline')
    );
    await act(async () => timeline?.click());
    expect(document.body.textContent).toContain('Mail provider accepted the message');
    expect(document.body.textContent).toContain('Delivery queue');
    expect(document.body.textContent).not.toContain('PROVIDER_ACCEPTED');
    expect(document.body.textContent).not.toContain('DWP_OUTBOX');
  });
});
