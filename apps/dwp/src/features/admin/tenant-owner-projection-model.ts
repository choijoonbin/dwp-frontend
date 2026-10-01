import { HttpError } from '@dwp-frontend/shared-utils';

import type {
  TenantProviderDataGovernanceProjection,
  TenantProviderDomainProjection,
} from '@dwp-frontend/shared-utils';

export type OwnerProjectionErrorState =
  'AUTHORITY_REVOKED' | 'TENANT_MAPPING_MISSING' | 'UNAVAILABLE';

const LABEL_VALUES = {
  states: new Set([
    'PENDING',
    'VERIFIED',
    'FAILED',
    'SCHEDULED',
    'ACTIVE',
    'INACTIVE',
    'EXPIRED',
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED_FOR_HANDOFF',
    'REJECTED',
    'BLOCKED_BY_HOLD',
    'CANCELLED',
  ]),
  domainTypes: new Set(['LOGIN', 'EMAIL', 'CUSTOM']),
  verificationMethods: new Set(['DNS_TXT', 'HTTP', 'INTERNAL']),
  freshness: new Set(['OWNER_ATTESTED', 'NOT_OBSERVED', 'RECORDED_AT', 'CURRENT_OWNER_REVISION']),
  evidence: new Set(['NOT_RECORDED', 'IMPACT_FINGERPRINT_RECORDED', 'REFERENCES_REDACTED']),
  policyTypes: new Set(['RETENTION', 'LEGAL_HOLD']),
  actions: new Set(['RETIRE', 'PURGE']),
  holdStates: new Set(['OWNER_VERIFICATION_REQUIRED', 'ACTIVE_GLOBAL_LEGAL_HOLD']),
  exclusions: new Set([
    'TENANT_SCOPED_HOLD_OWNER_NOT_CONNECTED',
    'EXTERNAL_SHARING_OWNER_NOT_CONNECTED',
    'PHYSICAL_RETENTION_OR_DELETION_EXECUTION_NOT_OBSERVED',
  ]),
} as const;

function ownerLabelKey(kind: keyof typeof LABEL_VALUES, value: string): string {
  return `${kind}.${LABEL_VALUES[kind].has(value) ? value : 'UNKNOWN'}`;
}

export const ownerStateLabelKey = (value: string) => ownerLabelKey('states', value);
export const ownerDomainTypeLabelKey = (value: string) => ownerLabelKey('domainTypes', value);
export const ownerVerificationMethodLabelKey = (value: string) =>
  ownerLabelKey('verificationMethods', value);
export const ownerFreshnessLabelKey = (value: string) => ownerLabelKey('freshness', value);
export const ownerEvidenceLabelKey = (value: string) => ownerLabelKey('evidence', value);
export const ownerPolicyTypeLabelKey = (value: string) => ownerLabelKey('policyTypes', value);
export const ownerActionLabelKey = (value: string) => ownerLabelKey('actions', value);
export const ownerHoldStateLabelKey = (value: string) => ownerLabelKey('holdStates', value);
export const ownerExclusionLabelKey = (value: string) => ownerLabelKey('exclusions', value);

export function ownerProjectionErrorState(error: unknown): OwnerProjectionErrorState {
  if (error instanceof HttpError && error.status === 403) return 'AUTHORITY_REVOKED';
  if (error instanceof HttpError && error.status === 404) return 'TENANT_MAPPING_MISSING';
  return 'UNAVAILABLE';
}

export function domainObservationSummary(projection: TenantProviderDomainProjection) {
  return projection.domains.reduce(
    (summary, domain) => {
      summary.total += 1;
      if (domain.verificationState === 'VERIFIED') summary.verified += 1;
      if (domain.verificationState === 'PENDING') summary.pending += 1;
      if (domain.verificationState === 'FAILED') summary.failed += 1;
      if (domain.evidenceFreshnessState === 'NOT_OBSERVED') summary.notObserved += 1;
      return summary;
    },
    { total: 0, verified: 0, pending: 0, failed: 0, notObserved: 0 }
  );
}

export function dataGovernanceObservationSummary(
  projection: TenantProviderDataGovernanceProjection
) {
  return {
    activeRetentionPolicies: projection.policies.filter(
      (policy) => policy.policyType === 'RETENTION' && policy.effectiveState === 'ACTIVE'
    ).length,
    activeLegalHolds: projection.policies.filter(
      (policy) =>
        policy.policyType === 'LEGAL_HOLD' &&
        policy.effectiveState === 'ACTIVE' &&
        policy.legalHoldActive === true
    ).length,
    blockedLifecycleRequests: projection.tenantLifecycleHoldObservations.filter(
      (observation) => observation.lifecycleState === 'BLOCKED_BY_HOLD'
    ).length,
  };
}
