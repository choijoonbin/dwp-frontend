import { describe, expect, it } from 'vitest';

import {
  buildMailConnectionReadiness,
  buildMailOperationalExceptions,
  buildMailPurgeGateEvidence,
  canCancelMailDelivery,
  canSetMailConnectionState,
  enabledSharedInboxPermissions,
  getMailDeliveryRecoveryAvailability,
  getMailPurgeAvailability,
  resolveMailAdminFreshness,
  sharedInboxPermissionInputIsValid,
  sourceEvidenceState,
} from './mail-admin-operations-model';

import type { MailAdminOverview, MailConnection } from '@dwp-frontend/shared-utils';

const NOW = Date.parse('2026-09-16T06:00:00.000Z');

function connection(input: Partial<MailConnection> = {}): MailConnection {
  return {
    connectionId: 'connection-1',
    connectionKey: 'sandbox',
    displayName: 'DWP Sandbox',
    providerType: 'DWP_SANDBOX',
    authenticationMode: 'LOCAL',
    mailDomain: null,
    state: 'ACTIVE',
    capabilities: ['SEND', 'SYNC'],
    credentialConfigured: false,
    lastSynchronizedAt: '2026-09-16T05:59:00.000Z',
    lastErrorCode: null,
    version: 4,
    ...input,
  };
}

function overview(input: Partial<MailAdminOverview> = {}): MailAdminOverview {
  return {
    personalAccounts: 12,
    sharedAccounts: 2,
    activeConnections: 1,
    degradedConnections: 0,
    openSharedThreads: 4,
    pendingAiProposals: 0,
    queuedDeliveries: 3,
    failedDeliveries: 0,
    policy: {
      externalSenderBanner: true,
      blockRemoteImages: true,
      allowSharedInboxes: true,
      aiAssistanceEnabled: true,
      aiCrossAppActionsEnabled: false,
      aiAutoExecuteEnabled: false,
      retentionDays: 365,
      maximumAttachmentMb: 25,
      version: 7,
    },
    connections: [connection()],
    sharedInboxes: [],
    providerCatalog: [
      {
        providerType: 'DWP_SANDBOX',
        name: 'DWP Sandbox',
        protocol: 'LOCAL',
        authenticationMode: 'LOCAL',
        capabilities: ['SEND', 'SYNC'],
        pushSupported: true,
        tenantWideSupported: true,
        runtimeState: 'AVAILABLE',
        adapterVersion: '2.4.0',
      },
    ],
    generatedAt: '2026-09-16T05:59:30.000Z',
    ...input,
  };
}

describe('mail admin operational evidence', () => {
  it('recognizes that the local sandbox does not require an external credential', () => {
    const [readiness] = buildMailConnectionReadiness(overview(), NOW);

    expect(readiness).toMatchObject({
      evidenceState: 'VERIFIED',
      activationAllowed: true,
      runtimeVerified: true,
      credentialVerified: true,
      synchronizationVerified: true,
      blockers: [],
    });
    expect(canSetMailConnectionState('ACTIVE', readiness)).toBe(true);
  });

  it('does not treat an external provider ACTIVE value as verified readiness', () => {
    const external = connection({
      connectionId: 'graph-1',
      connectionKey: 'graph',
      displayName: 'Microsoft Graph',
      providerType: 'MICROSOFT_GRAPH',
      authenticationMode: 'OAUTH2',
    });
    const data = overview({
      connections: [external],
      providerCatalog: [
        {
          providerType: 'MICROSOFT_GRAPH',
          name: 'Microsoft Graph',
          protocol: 'REST',
          authenticationMode: 'OAUTH2',
          capabilities: ['SEND', 'SYNC'],
          pushSupported: true,
          tenantWideSupported: true,
          runtimeState: 'AVAILABLE',
          adapterVersion: '1.0.0',
        },
      ],
    });

    const [readiness] = buildMailConnectionReadiness(data, NOW);

    expect(readiness.activationAllowed).toBe(false);
    expect(readiness.evidenceState).toBe('PARTIAL');
    expect(readiness.blockers).toContain('EXTERNAL_PROVIDER_EVIDENCE_UNAVAILABLE');
    expect(canSetMailConnectionState('ACTIVE', readiness)).toBe(false);
    expect(canSetMailConnectionState('SUSPENDED', readiness)).toBe(true);
  });

  it('marks old source data stale without inventing a health percentage', () => {
    const data = overview({ generatedAt: '2026-09-16T05:40:00.000Z' });

    expect(resolveMailAdminFreshness(data.generatedAt, NOW)).toBe('STALE');
    expect(buildMailConnectionReadiness(data, NOW)[0]).toMatchObject({
      evidenceState: 'STALE',
      activationAllowed: false,
    });
  });

  it('expires synchronization evidence after five minutes and rejects invalid or future times', () => {
    const atBoundary = overview({
      generatedAt: '2026-09-16T05:59:30.000Z',
      connections: [connection({ lastSynchronizedAt: '2026-09-16T05:55:00.000Z' })],
    });
    expect(buildMailConnectionReadiness(atBoundary, NOW)[0]).toMatchObject({
      synchronizationVerified: true,
      activationAllowed: true,
    });
    expect(buildMailConnectionReadiness(atBoundary, NOW + 1)[0]).toMatchObject({
      synchronizationVerified: false,
      activationAllowed: false,
      blockers: expect.arrayContaining(['SYNCHRONIZATION_STALE']),
    });

    for (const lastSynchronizedAt of ['not-an-instant', '2026-09-16T06:00:00.001Z']) {
      expect(
        buildMailConnectionReadiness(
          overview({ connections: [connection({ lastSynchronizedAt })] }),
          NOW
        )[0]
      ).toMatchObject({
        synchronizationVerified: false,
        activationAllowed: false,
        blockers: expect.arrayContaining(['SYNCHRONIZATION_UNVERIFIED']),
      });
    }
  });

  it('builds exception rows only from reported degraded connections and failures', () => {
    const data = overview({
      failedDeliveries: 2,
      connections: [connection({ state: 'DEGRADED' })],
    });

    expect(buildMailOperationalExceptions(data, NOW)).toEqual([
      {
        id: 'delivery:failed-aggregate',
        kind: 'DELIVERY',
        severity: 'critical',
        title: 'FAILED_DELIVERIES_REPORTED',
        count: 2,
        evidenceState: 'PARTIAL',
      },
      {
        id: 'connection:connection-1',
        kind: 'CONNECTION',
        severity: 'critical',
        title: 'DWP Sandbox',
        count: 1,
        evidenceState: 'PARTIAL',
      },
    ]);
  });
});

describe('mail delivery recovery safety', () => {
  it('blocks immediate retry for UNKNOWN and prefers reconciliation', () => {
    expect(
      getMailDeliveryRecoveryAvailability({
        deliveryId: 'delivery-unknown',
        state: 'UNKNOWN',
        retryEligibility: 'ELIGIBLE',
        providerDisposition: 'UNKNOWN',
        idempotencyState: 'REPLAY_SAFE',
        reconcileCapability: true,
      })
    ).toEqual({
      retryEnabled: false,
      reconcileEnabled: true,
      blockedReason: 'RESULT_UNKNOWN_RECONCILE_FIRST',
    });
  });

  it('enables retry only with eligibility and duplicate-safety evidence', () => {
    expect(
      getMailDeliveryRecoveryAvailability(
        {
          deliveryId: 'delivery-failed',
          state: 'FAILED',
          retryEligibility: 'ELIGIBLE',
          providerDisposition: 'UNKNOWN',
          idempotencyState: 'REPLAY_SAFE',
          reconcileCapability: true,
          evidenceGeneratedAt: '2026-09-16T05:59:00.000Z',
        },
        NOW
      ).retryEnabled
    ).toBe(true);

    expect(
      getMailDeliveryRecoveryAvailability(
        {
          deliveryId: 'delivery-unverified',
          state: 'FAILED',
          retryEligibility: 'ELIGIBLE',
          providerDisposition: 'UNKNOWN',
          idempotencyState: 'UNKNOWN',
          reconcileCapability: true,
          evidenceGeneratedAt: '2026-09-16T05:59:00.000Z',
        },
        NOW
      )
    ).toMatchObject({
      retryEnabled: false,
      blockedReason: 'DUPLICATE_SAFETY_UNVERIFIED',
    });
  });

  it('requires present, valid, non-future, and recent retry evidence', () => {
    const evidence = {
      deliveryId: 'delivery-failed',
      state: 'FAILED' as const,
      retryEligibility: 'ELIGIBLE' as const,
      providerDisposition: 'NOT_ACCEPTED' as const,
      idempotencyState: 'REPLAY_SAFE' as const,
      reconcileCapability: true,
    };

    for (const evidenceGeneratedAt of [
      undefined,
      'not-an-instant',
      '2026-09-16T06:00:00.001Z',
      '2026-09-16T05:57:59.999Z',
    ]) {
      expect(
        getMailDeliveryRecoveryAvailability({ ...evidence, evidenceGeneratedAt }, NOW)
      ).toEqual({
        retryEnabled: false,
        reconcileEnabled: true,
        blockedReason: 'RECOVERY_EVIDENCE_NOT_CURRENT',
      });
    }

    expect(
      getMailDeliveryRecoveryAvailability(
        { ...evidence, evidenceGeneratedAt: '2026-09-16T05:58:00.000Z' },
        NOW
      )
    ).toEqual({ retryEnabled: true, reconcileEnabled: false, blockedReason: null });
  });

  it('never retries an accepted or confirmed delivery even if inputs conflict', () => {
    for (const state of ['ACCEPTED_BY_PROVIDER', 'DELIVERED_CONFIRMED'] as const) {
      expect(
        getMailDeliveryRecoveryAvailability({
          deliveryId: `delivery-${state}`,
          state,
          retryEligibility: 'ELIGIBLE',
          providerDisposition: 'NOT_ACCEPTED',
          idempotencyState: 'REPLAY_SAFE',
          reconcileCapability: true,
        })
      ).toEqual({
        retryEnabled: false,
        reconcileEnabled: false,
        blockedReason: 'NOT_RETRYABLE',
      });
    }
  });
});

describe('mail purge safety', () => {
  it('fails closed while hold and approval evidence is missing', () => {
    expect(
      getMailPurgeAvailability({
        purgeApiAvailable: false,
        legalHoldState: 'UNKNOWN',
        candidateSnapshotId: null,
        policyVersion: 7,
        distinctApproverCount: 0,
        authorizationCurrent: false,
      })
    ).toEqual({
      previewEnabled: false,
      executeEnabled: false,
      blockers: [
        'PURGE_API_UNAVAILABLE',
        'LEGAL_HOLD_UNVERIFIED',
        'CANDIDATE_SNAPSHOT_REQUIRED',
        'TWO_APPROVERS_REQUIRED',
        'AUTHORIZATION_STALE',
      ],
    });
  });

  it('allows purge only after every destructive-action gate is evidenced', () => {
    expect(
      getMailPurgeAvailability({
        purgeApiAvailable: true,
        legalHoldState: 'CLEAR',
        candidateSnapshotId: 'snapshot-42',
        policyVersion: 7,
        distinctApproverCount: 2,
        authorizationCurrent: true,
      })
    ).toEqual({ previewEnabled: true, executeEnabled: true, blockers: [] });
  });

  it('allows a candidate preview while a known hold remains an execution blocker', () => {
    expect(
      getMailPurgeAvailability({
        purgeApiAvailable: true,
        legalHoldState: 'ACTIVE',
        candidateSnapshotId: null,
        policyVersion: 7,
        distinctApproverCount: 0,
        authorizationCurrent: true,
      })
    ).toEqual({
      previewEnabled: true,
      executeEnabled: false,
      blockers: ['LEGAL_HOLD_ACTIVE', 'CANDIDATE_SNAPSHOT_REQUIRED', 'TWO_APPROVERS_REQUIRED'],
    });
  });

  it('derives the destructive-action gate from the current retention snapshot', () => {
    const evidence = buildMailPurgeGateEvidence(
      {
        generatedAt: '2026-09-16T05:59:00.000Z',
        policyVersion: 7,
        resourcePolicies: [],
        holds: [],
        purgeJobs: [],
        candidate: {
          candidateSnapshotId: 'snapshot-7',
          fingerprint: 'sha256:abc',
          totalCandidates: 12,
          heldCount: 0,
          eligibleCount: 12,
          partialSources: [],
          generatedAt: '2026-09-16T05:59:00.000Z',
          expiresAt: '2026-09-16T06:09:00.000Z',
          policyVersion: 7,
          distinctApproverCount: 2,
        },
      },
      true
    );

    expect(evidence).toEqual({
      purgeApiAvailable: true,
      legalHoldState: 'CLEAR',
      candidateSnapshotId: 'snapshot-7',
      policyVersion: 7,
      distinctApproverCount: 2,
      authorizationCurrent: true,
    });
    expect(getMailPurgeAvailability(evidence).executeEnabled).toBe(true);
  });
});

describe('mail administrative action gates', () => {
  it('maps source collection status without inventing verification', () => {
    expect(sourceEvidenceState({ sourceId: 'AUDIT', state: 'CURRENT' })).toBe('VERIFIED');
    expect(sourceEvidenceState({ sourceId: 'PROVIDER', state: 'PARTIAL' })).toBe('PARTIAL');
    expect(sourceEvidenceState({ sourceId: 'EVENT', state: 'UNAVAILABLE' })).toBe('UNAVAILABLE');
  });

  it('only permits cancellation before provider submission or acceptance', () => {
    const base = {
      deliveryId: 'delivery-1',
      state: 'QUEUED' as const,
      retryEligibility: 'INELIGIBLE' as const,
      providerDisposition: 'UNKNOWN' as const,
      idempotencyState: 'REPLAY_SAFE' as const,
      reconcileCapability: true,
      safeResourceRef: 'message:••42',
      commandType: 'SEND',
      actorName: 'Operator',
      accountName: 'Operations',
      providerType: 'DWP_SANDBOX',
      cancelCapability: true,
      correlationId: 'corr-1',
      timeline: [],
      version: 2,
    };

    expect(canCancelMailDelivery({ ...base, stage: 'OUTBOX' })).toBe(true);
    expect(
      canCancelMailDelivery({
        ...base,
        state: 'ACCEPTED_BY_PROVIDER',
        stage: 'ACCEPTED_BY_PROVIDER',
      })
    ).toBe(false);
  });

  it('requires an identified member, at least one permission, and impact acknowledgement', () => {
    const permissions = {
      read: true,
      sendAs: false,
      sendOnBehalf: false,
      assign: true,
      manage: false,
    };
    expect(enabledSharedInboxPermissions(permissions)).toEqual(['read', 'assign']);
    expect(
      sharedInboxPermissionInputIsValid({
        userId: 42,
        displayName: 'Alex Kim',
        permissions,
        impactAcknowledged: true,
        version: 3,
      })
    ).toBe(true);
    expect(
      sharedInboxPermissionInputIsValid({
        userId: 42,
        displayName: 'Alex Kim',
        permissions,
        impactAcknowledged: false,
        version: 3,
      })
    ).toBe(false);
  });
});
