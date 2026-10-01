import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  dataGovernanceObservationSummary,
  domainObservationSummary,
  ownerProjectionErrorState,
  ownerActionLabelKey,
  ownerDomainTypeLabelKey,
  ownerEvidenceLabelKey,
  ownerExclusionLabelKey,
  ownerFreshnessLabelKey,
  ownerHoldStateLabelKey,
  ownerPolicyTypeLabelKey,
  ownerStateLabelKey,
  ownerVerificationMethodLabelKey,
} from './tenant-owner-projection-model';

import type {
  TenantProviderDataGovernanceProjection,
  TenantProviderDomainProjection,
} from '@dwp-frontend/shared-utils';

describe('tenant owner projection model', () => {
  it('keeps authority and tenant mapping failures distinct from owner unavailability', () => {
    expect(ownerProjectionErrorState(new HttpError('denied', 403))).toBe('AUTHORITY_REVOKED');
    expect(ownerProjectionErrorState(new HttpError('unmapped', 404))).toBe(
      'TENANT_MAPPING_MISSING'
    );
    expect(ownerProjectionErrorState(new HttpError('down', 503))).toBe('UNAVAILABLE');
  });

  it('fails closed when an owner adds an unknown presentation value', () => {
    for (const key of [
      ownerStateLabelKey('INTERNAL_STATE'),
      ownerDomainTypeLabelKey('INTERNAL_DOMAIN'),
      ownerVerificationMethodLabelKey('INTERNAL_METHOD'),
      ownerFreshnessLabelKey('INTERNAL_FRESHNESS'),
      ownerEvidenceLabelKey('INTERNAL_EVIDENCE'),
      ownerPolicyTypeLabelKey('INTERNAL_POLICY'),
      ownerActionLabelKey('INTERNAL_ACTION'),
      ownerHoldStateLabelKey('INTERNAL_HOLD'),
      ownerExclusionLabelKey('INTERNAL_EXCLUSION'),
    ]) {
      expect(key).toMatch(/\.UNKNOWN$/);
      expect(key).not.toContain('INTERNAL_');
    }
  });

  it('summarizes recorded owner state without inventing unobserved verification', () => {
    const domains = {
      domains: [
        { verificationState: 'VERIFIED', evidenceFreshnessState: 'OWNER_ATTESTED' },
        { verificationState: 'PENDING', evidenceFreshnessState: 'NOT_OBSERVED' },
        { verificationState: 'FAILED', evidenceFreshnessState: 'RECORDED_AT' },
      ],
    } as TenantProviderDomainProjection;
    expect(domainObservationSummary(domains)).toEqual({
      total: 3,
      verified: 1,
      pending: 1,
      failed: 1,
      notObserved: 1,
    });

    const governance = {
      policies: [
        { policyType: 'RETENTION', effectiveState: 'ACTIVE' },
        { policyType: 'LEGAL_HOLD', effectiveState: 'SCHEDULED', legalHoldActive: true },
        { policyType: 'LEGAL_HOLD', effectiveState: 'ACTIVE', legalHoldActive: true },
      ],
      tenantLifecycleHoldObservations: [
        { lifecycleState: 'BLOCKED_BY_HOLD' },
        { lifecycleState: 'PENDING_APPROVAL' },
      ],
    } as TenantProviderDataGovernanceProjection;
    expect(dataGovernanceObservationSummary(governance)).toEqual({
      activeRetentionPolicies: 1,
      activeLegalHolds: 1,
      blockedLifecycleRequests: 1,
    });
  });
});
