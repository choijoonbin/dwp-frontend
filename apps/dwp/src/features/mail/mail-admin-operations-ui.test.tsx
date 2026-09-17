// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByLabelText } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MailAdminOperationsContent } from './mail-admin-operations-ui';

import type {
  MailAdminOverview,
  MailLegalHoldReleasePreview,
  MailRetentionSnapshot,
} from '@dwp-frontend/shared-utils';
import type { MailDeliveryRecoveryEvidence } from './mail-admin-operations-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

const NOW = Date.parse('2026-09-16T06:00:00.000Z');
const PURGE_SNAPSHOT_RESOURCES = {
  resourceCounts: { THREADS: 4, MESSAGES: 8, ATTACHMENTS: 2, DRAFTS: 1 },
  heldResourceCounts: { THREADS: 0, MESSAGES: 0, ATTACHMENTS: 0, DRAFTS: 0 },
  exclusionReasonCounts: { LEGAL_HOLD: 0, IMMUTABLE_EVIDENCE: 0 },
  resourceTypes: ['THREADS', 'MESSAGES', 'ATTACHMENTS', 'DRAFTS'] as const,
  scope: { tenant: true },
};

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

const activeHold = {
  holdId: 'hold-1',
  name: 'Investigation hold',
  safeCaseRef: 'CASE-42',
  scope: { accountIds: ['account-1'] },
  status: 'ACTIVE' as const,
  startsAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-12-31T23:59:59.999Z',
  version: 4,
};

const releaseCounts = { THREADS: 2, MESSAGES: 5, ATTACHMENTS: 1, DRAFTS: 0 };

function releasePreview(state: MailLegalHoldReleasePreview['state']): MailLegalHoldReleasePreview {
  return {
    releasePreviewId: 'release-preview-1',
    holdId: activeHold.holdId,
    requesterUserId: 11,
    holdVersion: activeHold.version,
    policyVersion: 3,
    holdScope: activeHold.scope,
    retentionBoundary: '2026-08-01T00:00:00.000Z',
    fingerprint: 'sha256:release-review',
    impact: {
      affectedResourceCounts: releaseCounts,
      currentlyHeldResourceCounts: releaseCounts,
      purgeSafeAfterReleaseResourceCounts: {
        THREADS: 1,
        MESSAGES: 3,
        ATTACHMENTS: 0,
        DRAFTS: 0,
      },
      stillProtectedAfterReleaseResourceCounts: {
        THREADS: 1,
        MESSAGES: 2,
        ATTACHMENTS: 1,
        DRAFTS: 0,
      },
      providerCapabilityRequiredResourceCounts: {
        THREADS: 0,
        MESSAGES: 1,
        ATTACHMENTS: 0,
        DRAFTS: 0,
      },
    },
    state,
    distinctApproverCount: state === 'APPROVED' || state === 'RELEASED' ? 1 : 0,
    approvals: [],
    generatedAt: '2026-09-16T05:59:00.000Z',
    expiresAt: '2026-09-16T06:10:00.000Z',
  };
}

function retentionWithHold(): MailRetentionSnapshot {
  return {
    generatedAt: '2026-09-16T05:59:30.000Z',
    policyVersion: 3,
    resourcePolicies: [],
    holds: [activeHold],
    purgeJobs: [],
  };
}

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
    expect(onRetry).not.toHaveBeenCalled();
    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm retry'
    );
    expect(confirm).toBeDefined();
    await act(async () => confirm?.click());
    expect(onRetry).toHaveBeenCalledWith('delivery-1');
  });

  it('rechecks current retry permission and evidence while the confirmation is open', async () => {
    const onRetry = vi.fn();
    const render = async (canRetryDeliveries: boolean, evidenceGeneratedAt: string) =>
      act(async () =>
        root.render(
          <MailAdminOperationsContent
            surface="delivery-audit"
            overview={overview}
            canManage={false}
            canReadAudit
            canRetryDeliveries={canRetryDeliveries}
            now={NOW}
            deliveryEvidence={[delivery(evidenceGeneratedAt)]}
            onRetryDelivery={onRetry}
          />
        )
      );

    await render(true, '2026-09-16T05:59:00.000Z');
    const retry = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('delivery.retry')
    );
    await act(async () => retry?.click());

    await render(false, '2026-09-16T05:59:00.000Z');
    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm retry'
    );
    expect(confirm?.disabled).toBe(true);
    await act(async () => confirm?.click());
    expect(onRetry).not.toHaveBeenCalled();

    await render(true, '2026-09-16T05:57:00.000Z');
    expect(confirm?.disabled).toBe(true);
    await act(async () => confirm?.click());
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('rechecks cancellation access while the confirmation is open', async () => {
    const onCancel = vi.fn();
    const auditItem = {
      deliveryId: 'delivery-cancel-1',
      safeResourceRef: 'message:••77',
      commandType: 'SEND',
      actorName: 'Mail operator',
      accountName: 'Primary',
      providerType: 'DWP_SANDBOX',
      stage: 'OUTBOX' as const,
      state: 'QUEUED' as const,
      retryEligibility: 'UNKNOWN' as const,
      providerDisposition: 'NOT_ACCEPTED' as const,
      idempotencyState: 'UNKNOWN' as const,
      reconcileCapability: false,
      cancelCapability: true,
      evidenceGeneratedAt: '2026-09-16T05:59:00.000Z',
      lastEvidenceAt: '2026-09-16T05:59:00.000Z',
      correlationId: 'corr-cancel-1',
      timeline: [],
      version: 2,
    };
    const render = async (canCancelDeliveries: boolean) =>
      act(async () =>
        root.render(
          <MailAdminOperationsContent
            surface="delivery-audit"
            overview={overview}
            canManage={false}
            canReadAudit
            canCancelDeliveries={canCancelDeliveries}
            now={NOW}
            deliveryAudit={{
              items: [auditItem],
              total: 1,
              page: 0,
              pageSize: 50,
              generatedAt: '2026-09-16T05:59:30.000Z',
            }}
            onCancelDelivery={onCancel}
          />
        )
      );

    await render(true);
    const cancel = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'actions.cancel'
    );
    await act(async () => cancel?.click());
    await render(false);
    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm cancellation'
    );
    expect(confirm?.disabled).toBe(true);
    await act(async () => confirm?.click());
    expect(onCancel).not.toHaveBeenCalled();
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
        ...PURGE_SNAPSHOT_RESOURCES,
        candidateSnapshotId: 'snapshot-ready',
        fingerprint: 'sha256:ready',
        totalCandidates: 4,
        heldCount: 0,
        eligibleCount: 4,
        partialSources: [],
        generatedAt: '2026-09-16T05:59:30.000Z',
        before: '2026-09-01T00:00:00.000Z',
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
              ...PURGE_SNAPSHOT_RESOURCES,
              candidateSnapshotId: 'snapshot-1',
              fingerprint: 'sha256:one',
              totalCandidates: 4,
              heldCount: 0,
              eligibleCount: 4,
              partialSources: [],
              generatedAt: '2026-09-16T05:59:30.000Z',
              before: '2026-09-01T00:00:00.000Z',
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

  it('requires a reviewed release preview, separate approval, and acknowledgement before release', async () => {
    const awaiting = releasePreview('AWAITING_APPROVAL');
    const approved = releasePreview('APPROVED');
    const onPreview = vi.fn().mockResolvedValue(awaiting);
    const onApprove = vi.fn().mockResolvedValue(approved);
    const onExecute = vi.fn().mockResolvedValue(true);
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="retention"
          overview={overview}
          canManage={false}
          canManageHolds
          now={NOW}
          retention={retentionWithHold()}
          onPreviewLegalHoldRelease={onPreview}
          onApproveLegalHoldRelease={onApprove}
          onExecuteLegalHoldRelease={onExecute}
        />
      )
    );

    const release = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Release hold'
    );
    await act(async () => {
      release?.click();
      await Promise.resolve();
    });
    expect(onPreview).toHaveBeenCalledWith(activeHold);
    expect(document.body.textContent).toContain('release-preview-1');
    expect(onApprove).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();

    const approve = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Approve release impact'
    );
    await act(async () => {
      approve?.click();
      await Promise.resolve();
    });
    expect(onApprove).toHaveBeenCalledWith(awaiting);

    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm hold release'
    );
    expect(confirm?.disabled).toBe(true);
    const acknowledgement = document.body.querySelector<HTMLInputElement>('input[type="checkbox"]');
    await act(async () => acknowledgement?.click());
    expect(confirm?.disabled).toBe(false);
    await act(async () => {
      confirm?.click();
      await Promise.resolve();
    });
    expect(onExecute).toHaveBeenCalledWith(approved);
  });

  it('keeps an active hold protection scope and dates immutable during metadata edits', async () => {
    const onUpdate = vi.fn();
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="retention"
          overview={overview}
          canManage={false}
          canManageHolds
          now={NOW}
          retention={retentionWithHold()}
          onUpdateLegalHold={onUpdate}
          onPreviewLegalHoldRelease={vi.fn().mockResolvedValue(null)}
        />
      )
    );

    const edit = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Edit'
    );
    await act(async () => edit?.click());
    expect(document.body.textContent).toContain('Protection scope and dates are locked');
    expect(document.body.textContent).toContain(JSON.stringify(activeHold.scope));
    expect(document.body.querySelector('input[type="date"]')).toBeNull();

    const name = getByLabelText(document.body, 'Hold name');
    await act(async () => fireEvent.change(name, { target: { value: 'Updated case label' } }));
    const save = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'actions.save'
    );
    await act(async () => save?.click());

    expect(onUpdate).toHaveBeenCalledWith(activeHold.holdId, {
      name: 'Updated case label',
      safeCaseRef: activeHold.safeCaseRef,
      scope: activeHold.scope,
      startsAt: activeHold.startsAt,
      expiresAt: activeHold.expiresAt,
      version: activeHold.version,
    });
  });

  it.each(['REJECTED', 'EXPIRED', 'RELEASED'] as const)(
    'keeps a %s release preview terminal and blocks approval and execution',
    async (state) => {
      const onApprove = vi.fn();
      const onExecute = vi.fn();
      await act(async () =>
        root.render(
          <MailAdminOperationsContent
            surface="retention"
            overview={overview}
            canManage={false}
            canManageHolds
            now={NOW}
            retention={retentionWithHold()}
            onPreviewLegalHoldRelease={vi.fn().mockResolvedValue(releasePreview(state))}
            onApproveLegalHoldRelease={onApprove}
            onExecuteLegalHoldRelease={onExecute}
          />
        )
      );

      const release = [...host.querySelectorAll('button')].find(
        (button) => button.textContent === 'Release hold'
      );
      await act(async () => {
        release?.click();
        await Promise.resolve();
      });
      expect(document.body.textContent).toContain('This release review is closed');
      expect(
        [...document.body.querySelectorAll('button')].some(
          (button) => button.textContent === 'Approve release impact'
        )
      ).toBe(false);
      expect(
        [...document.body.querySelectorAll('button')].some(
          (button) => button.textContent === 'Confirm hold release'
        )
      ).toBe(false);
      expect(onApprove).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
    }
  );

  it('opens a purge scope form and submits the reviewed default cascade', async () => {
    const onPreview = vi.fn();
    await act(async () =>
      root.render(
        <MailAdminOperationsContent
          surface="retention"
          overview={overview}
          canManage={false}
          canPreviewPurge
          now={NOW}
          retention={{ ...retentionWithHold(), holds: [] }}
          onPreviewPurge={onPreview}
        />
      )
    );

    const open = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Preview purge'
    );
    await act(async () => open?.click());
    expect(onPreview).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Choose purge preview scope');

    const submit = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Preview purge' && button !== open
    );
    await act(async () => submit?.click());
    expect(onPreview).toHaveBeenCalledWith({
      scope: { tenant: true, resourceTypes: [...PURGE_SNAPSHOT_RESOURCES.resourceTypes] },
      resourceTypes: [...PURGE_SNAPSHOT_RESOURCES.resourceTypes],
      before: '2026-09-16T23:59:59.999Z',
    });
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
          onPreviewSharedMemberRevoke={vi.fn().mockResolvedValue({
            previewId: 'preview-1',
            fingerprint: 'a'.repeat(64),
            activeAssignments: 0,
            openDrafts: 0,
            pendingCommands: 0,
            providerRevocationRequired: false,
            memberVersion: 7,
            generatedAt: '2026-09-17T09:00:00Z',
            expiresAt: '2026-09-17T09:05:00Z',
          })}
          onRemoveSharedMember={onRemove}
        />
      )
    );

    const revoke = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Revoke'
    );
    await act(async () => {
      revoke?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm revocation'
    );
    await act(async () => confirm?.click());

    expect(onRemove).toHaveBeenCalledWith(
      'shared-1',
      expect.objectContaining({ memberId: 'member-1', version: 7 }),
      expect.objectContaining({ previewId: 'preview-1', memberVersion: 7 }),
      false
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
