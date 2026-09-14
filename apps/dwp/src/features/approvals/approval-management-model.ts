import type {
  ApprovalAdminPulse,
  ApprovalIntegrationDelivery,
  ApprovalOperations,
  ApprovalSignatureProvider,
} from '@dwp-frontend/shared-utils';

import { approvalManagementReadDenied } from './approval-management-source-state';

export type ApprovalSignatureReadiness =
  | 'UNKNOWN'
  | 'DISABLED'
  | 'DEGRADED'
  | 'CONFIGURATION_REQUIRED'
  | 'NOT_VERIFIED'
  | 'READY'
  | 'EXTERNAL_VERIFICATION_REQUIRED';

export type ApprovalRetryEligibilityReason =
  | 'UNKNOWN'
  | 'ELIGIBLE'
  | 'STATUS_NOT_RETRYABLE'
  | 'AUDITOR_ASSIGNMENT_NOT_READY'
  | 'SCOPE_EVIDENCE_MISMATCH'
  | 'RECOVERY_EVIDENCE_INCOMPLETE'
  | 'SEPARATION_OF_DUTIES';

export type ApprovalDeliveryRetryEligibility = Readonly<{
  eligible: boolean;
  reason: ApprovalRetryEligibilityReason;
  expectedVersion: number | null;
  evaluatedAt: string | null;
}>;

export type ApprovalCapabilityEntry = Readonly<{
  key: string;
  value: string;
}>;

export type ApprovalOperationSummary = Readonly<{
  breached: number;
  retryCandidates: number;
  blockedDeliveries: number;
  totalDeliveries: number;
}>;

export type ApprovalOverviewException = Readonly<
  {
    key: 'overdue' | 'failedIntegrations' | ApprovalAdminPulse['assurance'][number]['key'];
    count: number;
    severity: 'warning' | 'error';
  } & (
    | {
        target: 'operations';
        route:
          | '/approvals/admin/operations'
          | '/approvals/admin/operations?queue=sla'
          | '/approvals/admin/operations?queue=delivery';
      }
    | { target: 'policies'; route: '/approvals/admin/policies' }
  )
>;

export const APPROVAL_OVERVIEW_FRESHNESS_MS = 20_000;

export type ApprovalOverviewSource = Readonly<{
  data: ApprovalAdminPulse | undefined;
  dataUpdatedAt: number;
  error: unknown;
  failureReason: unknown;
  failureCount: number;
  status: 'pending' | 'error' | 'success';
  fetchStatus: 'fetching' | 'paused' | 'idle';
}>;

export function approvalOverviewSourceState(
  source: ApprovalOverviewSource | undefined,
  nowMs: number,
  previouslyDenied = false
) {
  if (
    previouslyDenied ||
    approvalManagementReadDenied(source?.failureReason) ||
    approvalManagementReadDenied(source?.error)
  )
    return 'DENIED';
  if (!source || source.data === undefined) {
    return source?.status === 'pending' && source.error == null && source.failureReason == null
      ? 'LOADING'
      : 'UNAVAILABLE';
  }
  if (
    source.status !== 'success' ||
    source.error != null ||
    source.failureReason != null ||
    source.failureCount > 0
  )
    return 'STALE';
  if (source.fetchStatus !== 'idle') return 'CHECKING';
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(source.dataUpdatedAt) ||
    source.dataUpdatedAt <= 0 ||
    nowMs < source.dataUpdatedAt ||
    nowMs - source.dataUpdatedAt >= APPROVAL_OVERVIEW_FRESHNESS_MS
  )
    return 'EXPIRED';
  return 'READY';
}

export const APPROVAL_OVERVIEW_ASSURANCE_KEYS = [
  'identity',
  'segregation',
  'evidence',
  'delivery',
] as const;

export type ApprovalOverviewHealth = 'HEALTHY' | 'ATTENTION' | 'INCOMPLETE';

export type ApprovalOverviewAssessment = Readonly<{
  health: ApprovalOverviewHealth;
  assurance: ReadonlyArray<ApprovalAdminPulse['assurance'][number]>;
}>;

const DISPLAYABLE_SIGNATURE_CAPABILITIES = [
  'internalAttestation',
  'auditEvidence',
  'verifiedIdentity',
  'remoteSigningSupported',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isApprovalOverviewAssuranceKey(
  value: unknown
): value is ApprovalAdminPulse['assurance'][number]['key'] {
  return (
    typeof value === 'string' &&
    (APPROVAL_OVERVIEW_ASSURANCE_KEYS as readonly string[]).includes(value)
  );
}

export function assessApprovalOverview(
  pulse: ApprovalAdminPulse | undefined
): ApprovalOverviewAssessment {
  if (!pulse) return { health: 'INCOMPLETE', assurance: [] };

  const rawAssurance = (pulse as ApprovalAdminPulse & { assurance?: unknown }).assurance;
  if (!Array.isArray(rawAssurance)) return { health: 'INCOMPLETE', assurance: [] };

  const byKey = new Map<
    ApprovalAdminPulse['assurance'][number]['key'],
    ApprovalAdminPulse['assurance'][number]
  >();
  let contractComplete = rawAssurance.length === APPROVAL_OVERVIEW_ASSURANCE_KEYS.length;

  for (const value of rawAssurance) {
    if (
      !isRecord(value) ||
      !isApprovalOverviewAssuranceKey(value.key) ||
      (value.state !== 'ENFORCED' && value.state !== 'ATTENTION') ||
      !isNonNegativeInteger(value.exceptions) ||
      byKey.has(value.key)
    ) {
      contractComplete = false;
      continue;
    }
    byKey.set(value.key, {
      key: value.key,
      state: value.state,
      exceptions: value.exceptions,
    });
  }

  const assurance = APPROVAL_OVERVIEW_ASSURANCE_KEYS.flatMap((key) => {
    const signal = byKey.get(key);
    return signal ? [signal] : [];
  });
  contractComplete =
    contractComplete && assurance.length === APPROVAL_OVERVIEW_ASSURANCE_KEYS.length;

  const counters = [
    pulse.publishedWorkflows,
    pulse.draftWorkflows,
    pulse.activeRequests,
    pulse.overdueTasks,
    pulse.failedIntegrations,
  ];
  if (!contractComplete || !counters.every(isNonNegativeInteger)) {
    return { health: 'INCOMPLETE', assurance };
  }

  const healthy =
    pulse.overdueTasks === 0 &&
    pulse.failedIntegrations === 0 &&
    assurance.every((signal) => signal.state === 'ENFORCED' && signal.exceptions === 0);
  return { health: healthy ? 'HEALTHY' : 'ATTENTION', assurance };
}

export function approvalProviderCapabilityEntries(
  provider: ApprovalSignatureProvider
): ApprovalCapabilityEntry[] {
  const capabilities = (provider as ApprovalSignatureProvider & { capabilities?: unknown })
    .capabilities;
  if (!isRecord(capabilities)) return [];

  return DISPLAYABLE_SIGNATURE_CAPABILITIES.flatMap((key) =>
    typeof capabilities[key] === 'boolean' ? [{ key, value: String(capabilities[key]) }] : []
  ).sort((left, right) => left.key.localeCompare(right.key));
}

export function approvalSignatureReadiness(
  provider: ApprovalSignatureProvider
): ApprovalSignatureReadiness {
  const capabilities = (provider as ApprovalSignatureProvider & { capabilities?: unknown })
    .capabilities;
  if (!isRecord(capabilities) || typeof capabilities.readiness !== 'string') return 'UNKNOWN';

  const readiness = capabilities.readiness.toUpperCase();
  if (readiness === 'DISABLED') return 'DISABLED';
  if (readiness === 'DEGRADED') return 'DEGRADED';
  if (readiness === 'CONFIGURATION_REQUIRED') return 'CONFIGURATION_REQUIRED';
  if (readiness === 'NOT_VERIFIED') return 'NOT_VERIFIED';
  if (readiness === 'EXTERNAL_VERIFICATION_REQUIRED') return 'EXTERNAL_VERIFICATION_REQUIRED';
  if (readiness !== 'READY') return 'UNKNOWN';

  return provider.providerType === 'INTERNAL_ATTESTATION' &&
    provider.lifecycleState === 'ACTIVE' &&
    capabilities.internalAttestation === true &&
    capabilities.auditEvidence === true &&
    capabilities.verifiedIdentity === true
    ? 'READY'
    : 'UNKNOWN';
}

const RETRY_REASONS = new Set<ApprovalRetryEligibilityReason>([
  'ELIGIBLE',
  'STATUS_NOT_RETRYABLE',
  'AUDITOR_ASSIGNMENT_NOT_READY',
  'SCOPE_EVIDENCE_MISMATCH',
  'RECOVERY_EVIDENCE_INCOMPLETE',
  'SEPARATION_OF_DUTIES',
]);

export function approvalDeliveryRetryEligibility(
  delivery: ApprovalIntegrationDelivery
): ApprovalDeliveryRetryEligibility {
  const value = (
    delivery as ApprovalIntegrationDelivery & {
      retryEligibility?: unknown;
    }
  ).retryEligibility;
  if (!isRecord(value) || typeof value.reason !== 'string') {
    return { eligible: false, reason: 'UNKNOWN', expectedVersion: null, evaluatedAt: null };
  }
  const reason = value.reason.toUpperCase() as ApprovalRetryEligibilityReason;
  if (!RETRY_REASONS.has(reason)) {
    return { eligible: false, reason: 'UNKNOWN', expectedVersion: null, evaluatedAt: null };
  }
  const expectedVersion = value.expectedVersion;
  const evaluatedAt = value.evaluatedAt;
  const evidenceValid =
    Number.isSafeInteger(expectedVersion) &&
    expectedVersion === delivery.version &&
    typeof evaluatedAt === 'string' &&
    Number.isFinite(Date.parse(evaluatedAt));
  return {
    eligible:
      value.eligible === true &&
      reason === 'ELIGIBLE' &&
      evidenceValid &&
      (delivery.status === 'FAILED' || delivery.status === 'DEAD'),
    reason: evidenceValid ? reason : 'UNKNOWN',
    expectedVersion: evidenceValid ? (expectedVersion as number) : null,
    evaluatedAt: evidenceValid ? evaluatedAt : null,
  };
}

export function isApprovalDeliveryRetryCandidate(delivery: ApprovalIntegrationDelivery): boolean {
  return approvalDeliveryRetryEligibility(delivery).eligible;
}

export function summarizeApprovalOperations(
  operations: ApprovalOperations | undefined
): ApprovalOperationSummary {
  const deliveries = operations?.integrationDeliveries ?? [];
  const retryCandidates = deliveries.filter(isApprovalDeliveryRetryCandidate).length;
  return {
    breached: operations?.breachedTasks.length ?? 0,
    retryCandidates,
    blockedDeliveries: deliveries.length - retryCandidates,
    totalDeliveries: deliveries.length,
  };
}

export function approvalOverviewExceptions(
  pulse: ApprovalAdminPulse | undefined
): ApprovalOverviewException[] {
  if (!pulse) return [];
  const exceptions: ApprovalOverviewException[] = [];
  if (pulse.overdueTasks > 0) {
    exceptions.push({
      key: 'overdue',
      count: pulse.overdueTasks,
      target: 'operations',
      route: '/approvals/admin/operations?queue=sla',
      severity: 'warning',
    });
  }
  if (pulse.failedIntegrations > 0) {
    exceptions.push({
      key: 'failedIntegrations',
      count: pulse.failedIntegrations,
      target: 'operations',
      route: '/approvals/admin/operations?queue=delivery',
      severity: 'error',
    });
  }
  for (const signal of assessApprovalOverview(pulse).assurance) {
    if (signal.exceptions <= 0) continue;
    const target =
      signal.key === 'segregation'
        ? { target: 'policies' as const, route: '/approvals/admin/policies' as const }
        : {
            target: 'operations' as const,
            route:
              signal.key === 'delivery'
                ? ('/approvals/admin/operations?queue=delivery' as const)
                : ('/approvals/admin/operations' as const),
          };
    exceptions.push({
      key: signal.key,
      count: signal.exceptions,
      ...target,
      severity: signal.key === 'delivery' ? 'error' : 'warning',
    });
  }
  return exceptions;
}
