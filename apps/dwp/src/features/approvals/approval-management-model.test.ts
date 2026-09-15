import { describe, expect, it } from 'vitest';

import {
  approvalOverviewExceptions,
  assessApprovalOverview,
  approvalDeliveryRetryEligibility,
  approvalProviderCapabilityEntries,
  approvalSignatureReadiness,
  isApprovalDeliveryRetryCandidate,
  summarizeApprovalOperations,
} from './approval-management-model';
import { parseApprovalOperationsProjection } from './approval-management-projection';

import type {
  ApprovalAdminPulse,
  ApprovalIntegrationDelivery,
  ApprovalOperations,
  ApprovalSignatureProvider,
  ApprovalTask,
} from '@dwp-frontend/shared-utils';

type DeliveryProjection = ApprovalIntegrationDelivery & {
  retryEligibility?: {
    eligible: boolean;
    reason: string;
    expectedVersion: number;
    evaluatedAt: string;
  };
};

const delivery = (patch: Partial<DeliveryProjection> = {}): DeliveryProjection => ({
  outboxId: 'outbox-1',
  eventId: 'event-1',
  eventType: 'APPROVAL_COMPLETED',
  status: 'FAILED',
  attemptCount: 3,
  manualRetryCount: 0,
  version: 2,
  availableAt: '2026-09-11T01:00:00Z',
  createdAt: '2026-09-11T00:00:00Z',
  retryEligibility: {
    eligible: true,
    reason: 'ELIGIBLE',
    expectedVersion: 2,
    evaluatedAt: '2026-09-11T01:00:00Z',
  },
  ...patch,
});

const provider = (patch: Partial<ApprovalSignatureProvider> = {}): ApprovalSignatureProvider => ({
  providerId: 'provider-1',
  providerKey: 'DOCUSIGN',
  displayName: 'DocuSign',
  providerType: 'EXTERNAL',
  lifecycleState: 'ACTIVE',
  capabilities: {
    internalAttestation: false,
    auditEvidence: false,
    verifiedIdentity: false,
    remoteSigningSupported: true,
    readiness: 'EXTERNAL_VERIFICATION_REQUIRED',
  },
  credentialConfigured: true,
  lastHealthCheckedAt: '2026-09-11T01:00:00Z',
  version: 3,
  ...patch,
});

const task = (taskId: string): ApprovalTask => ({
  taskId,
  requestId: `request-${taskId}`,
  requestNumber: `APR-${taskId}`,
  title: 'Approval request',
  summary: 'Summary',
  workflowNameKo: '결재선',
  workflowNameEn: 'Approval route',
  stepKey: 'REVIEW',
  stepName: 'Review',
  stepSequence: 1,
  status: 'PENDING',
  priority: 'HIGH',
  dataClassification: 'CONFIDENTIAL',
  riskScore: 72,
  version: 1,
});

describe('approval management model', () => {
  it('fails closed when the sanitized signature projection omits capabilities', () => {
    const { capabilities: _capabilities, ...projectedResponse } = provider();
    const projected = projectedResponse as unknown as ApprovalSignatureProvider;

    expect(approvalProviderCapabilityEntries(projected)).toEqual([]);
    expect(approvalSignatureReadiness(projected)).toBe('UNKNOWN');
  });

  it('consumes the owner readiness contract and never promotes an external provider to ready', () => {
    expect(
      approvalSignatureReadiness(
        provider({
          capabilities: { readiness: 'CONFIGURATION_REQUIRED' },
          credentialConfigured: false,
        })
      )
    ).toBe('CONFIGURATION_REQUIRED');
    expect(
      approvalSignatureReadiness(
        provider({ capabilities: { readiness: 'NOT_VERIFIED' }, lastHealthCheckedAt: null })
      )
    ).toBe('NOT_VERIFIED');
    expect(approvalSignatureReadiness(provider())).toBe('EXTERNAL_VERIFICATION_REQUIRED');
    expect(approvalSignatureReadiness(provider({ capabilities: { readiness: 'READY' } }))).toBe(
      'UNKNOWN'
    );
  });

  it('reports ready only for a verified active internal attestation provider', () => {
    expect(
      approvalSignatureReadiness(
        provider({
          providerType: 'INTERNAL_ATTESTATION',
          providerKey: 'DWP_ATTESTATION',
          capabilities: {
            internalAttestation: true,
            auditEvidence: true,
            verifiedIdentity: true,
            readiness: 'READY',
          },
        })
      )
    ).toBe('READY');
    expect(
      approvalSignatureReadiness(
        provider({
          providerType: 'INTERNAL',
          lifecycleState: 'DISABLED',
          capabilities: { internalAttestation: true, readiness: 'READY' },
        })
      )
    ).toBe('UNKNOWN');
  });

  it('sorts only safe capability entries for display', () => {
    expect(
      approvalProviderCapabilityEntries(
        provider({
          capabilities: {
            internalAttestation: false,
            auditEvidence: true,
            verifiedIdentity: false,
            remoteSigningSupported: true,
            readiness: 'EXTERNAL_VERIFICATION_REQUIRED',
          },
        })
      )
    ).toEqual([
      { key: 'auditEvidence', value: 'true' },
      { key: 'internalAttestation', value: 'false' },
      { key: 'remoteSigningSupported', value: 'true' },
      { key: 'verifiedIdentity', value: 'false' },
    ]);
  });

  it('drops contract-external and non-boolean signature capability values', () => {
    const unsafeRuntimeProjection = {
      ...provider(),
      capabilities: {
        internalAttestation: false,
        auditEvidence: 'secret-shaped-value',
        verifiedIdentity: true,
        remoteSigningSupported: false,
        readiness: 'EXTERNAL_VERIFICATION_REQUIRED',
        credential: 'must-not-render',
        privateKey: { material: 'must-not-render' },
      },
    } as unknown as ApprovalSignatureProvider;

    const entries = approvalProviderCapabilityEntries(unsafeRuntimeProjection);
    expect(entries).toEqual([
      { key: 'internalAttestation', value: 'false' },
      { key: 'remoteSigningSupported', value: 'false' },
      { key: 'verifiedIdentity', value: 'true' },
    ]);
    expect(JSON.stringify(entries)).not.toContain('must-not-render');
    expect(JSON.stringify(entries)).not.toContain('secret-shaped-value');
  });

  it('treats only server-eligible deliveries with exact versioned evidence as retry candidates', () => {
    expect(isApprovalDeliveryRetryCandidate(delivery())).toBe(true);
    expect(
      isApprovalDeliveryRetryCandidate(
        delivery({
          status: 'DEAD',
          retryEligibility: { ...delivery().retryEligibility!, eligible: true },
        })
      )
    ).toBe(true);
    expect(isApprovalDeliveryRetryCandidate(delivery({ status: 'PUBLISHED' }))).toBe(false);
    expect(
      isApprovalDeliveryRetryCandidate(
        delivery({
          retryEligibility: {
            ...delivery().retryEligibility!,
            expectedVersion: 1,
          },
        })
      )
    ).toBe(false);
    expect(approvalDeliveryRetryEligibility(delivery({ retryEligibility: undefined }))).toEqual({
      eligible: false,
      reason: 'UNKNOWN',
      expectedVersion: null,
      evaluatedAt: null,
    });
    expect(
      approvalDeliveryRetryEligibility(
        delivery({
          retryEligibility: {
            ...delivery().retryEligibility!,
            eligible: false,
            reason: 'SEPARATION_OF_DUTIES',
          },
        })
      ).reason
    ).toBe('SEPARATION_OF_DUTIES');
  });

  it('summarizes operations without inventing health or success rates', () => {
    const operations = {
      generatedAt: '2026-09-11T01:00:00Z',
      signals: [],
      breachedTasks: [task('1'), task('2')],
      integrationDeliveries: [delivery(), delivery({ outboxId: 'outbox-2', status: 'PUBLISHED' })],
    } satisfies ApprovalOperations;

    expect(summarizeApprovalOperations(parseApprovalOperationsProjection(operations))).toEqual({
      breached: 2,
      retryCandidates: 1,
      blockedDeliveries: 1,
      totalDeliveries: 2,
    });
  });

  it('keeps unavailable operation counts unknown for restricted projections', () => {
    const restricted = parseApprovalOperationsProjection({
      generatedAt: '2026-09-11T01:00:00Z',
      signals: [],
      integrationDeliveries: [],
    });
    expect(summarizeApprovalOperations(restricted)).toEqual({
      breached: null,
      retryCandidates: null,
      blockedDeliveries: null,
      totalDeliveries: 0,
    });
  });

  it('derives only actionable exceptions from the overview snapshot', () => {
    const pulse: ApprovalAdminPulse = {
      publishedWorkflows: 4,
      draftWorkflows: 2,
      activeRequests: 18,
      overdueTasks: 3,
      failedIntegrations: 1,
      assurance: [
        { key: 'identity', state: 'ENFORCED', exceptions: 0 },
        { key: 'segregation', state: 'ATTENTION', exceptions: 2 },
        { key: 'evidence', state: 'ENFORCED', exceptions: 0 },
        { key: 'delivery', state: 'ATTENTION', exceptions: 1 },
      ],
    };

    expect(approvalOverviewExceptions(pulse)).toEqual([
      {
        key: 'overdue',
        count: 3,
        route: '/approvals/admin/operations?queue=sla',
        target: 'operations',
        severity: 'warning',
      },
      {
        key: 'failedIntegrations',
        count: 1,
        route: '/approvals/admin/operations?queue=delivery',
        target: 'operations',
        severity: 'error',
      },
      {
        key: 'segregation',
        count: 2,
        route: '/approvals/admin/policies',
        target: 'policies',
        severity: 'warning',
      },
      {
        key: 'delivery',
        count: 1,
        route: '/approvals/admin/operations?queue=delivery',
        target: 'operations',
        severity: 'error',
      },
    ]);
  });

  it('marks only the exact all-enforced zero-exception overview contract healthy', () => {
    const pulse: ApprovalAdminPulse = {
      publishedWorkflows: 4,
      draftWorkflows: 2,
      activeRequests: 18,
      overdueTasks: 0,
      failedIntegrations: 0,
      assurance: [
        { key: 'identity', state: 'ENFORCED', exceptions: 0 },
        { key: 'segregation', state: 'ENFORCED', exceptions: 0 },
        { key: 'evidence', state: 'ENFORCED', exceptions: 0 },
        { key: 'delivery', state: 'ENFORCED', exceptions: 0 },
      ],
    };

    expect(assessApprovalOverview(pulse)).toMatchObject({ health: 'HEALTHY' });
    expect(
      assessApprovalOverview({
        ...pulse,
        assurance: pulse.assurance.map((signal) =>
          signal.key === 'identity' ? { ...signal, state: 'ATTENTION' as const } : signal
        ),
      }).health
    ).toBe('ATTENTION');
    const contradictory = {
      ...pulse,
      assurance: pulse.assurance.map((signal) =>
        signal.key === 'evidence' ? { ...signal, exceptions: 2 } : signal
      ),
    };
    expect(assessApprovalOverview(contradictory).health).toBe('ATTENTION');
    expect(approvalOverviewExceptions(contradictory)).toContainEqual({
      key: 'evidence',
      count: 2,
      route: '/approvals/admin/operations',
      target: 'operations',
      severity: 'warning',
    });
  });

  it.each([
    {
      name: 'missing key',
      assurance: [
        { key: 'identity', state: 'ENFORCED', exceptions: 0 },
        { key: 'segregation', state: 'ENFORCED', exceptions: 0 },
        { key: 'evidence', state: 'ENFORCED', exceptions: 0 },
      ],
    },
    {
      name: 'duplicate key',
      assurance: [
        { key: 'identity', state: 'ENFORCED', exceptions: 0 },
        { key: 'identity', state: 'ENFORCED', exceptions: 0 },
        { key: 'evidence', state: 'ENFORCED', exceptions: 0 },
        { key: 'delivery', state: 'ENFORCED', exceptions: 0 },
      ],
    },
    {
      name: 'unknown key',
      assurance: [
        { key: 'identity', state: 'ENFORCED', exceptions: 0 },
        { key: 'segregation', state: 'ENFORCED', exceptions: 0 },
        { key: 'evidence', state: 'ENFORCED', exceptions: 0 },
        { key: 'release', state: 'ENFORCED', exceptions: 0 },
      ],
    },
  ])('does not infer overview health from a $name assurance set', ({ assurance }) => {
    const pulse = {
      publishedWorkflows: 4,
      draftWorkflows: 2,
      activeRequests: 18,
      overdueTasks: 0,
      failedIntegrations: 0,
      assurance,
    } as unknown as ApprovalAdminPulse;

    expect(assessApprovalOverview(pulse).health).toBe('INCOMPLETE');
  });
});
