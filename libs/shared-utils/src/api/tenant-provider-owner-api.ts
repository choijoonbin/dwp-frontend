import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const BASE = '/api/provider/v1/tenant/settings';

export type TenantProviderDomainObservation = {
  domainId: string;
  domainName: string;
  domainType: 'LOGIN' | 'EMAIL' | 'CUSTOM';
  verificationMethod: 'DNS_TXT' | 'HTTP' | 'INTERNAL';
  verificationState: 'PENDING' | 'VERIFIED' | 'FAILED';
  primaryDomain: boolean;
  verifiedAt?: string | null;
  lastCheckedAt?: string | null;
  sourceChangedAt: string;
  evidenceFreshnessState: 'OWNER_ATTESTED' | 'NOT_OBSERVED' | 'RECORDED_AT';
  version: number;
};

export type TenantProviderDomainProjection = {
  ownerService: 'provider-control-plane';
  observationState: 'LIVE_OWNER_READ';
  observedAt: string;
  sourceLastChangedAt?: string | null;
  coverageState: 'CURRENT_TENANT_NON_REVOKED_DOMAINS';
  exclusions: string[];
  domains: TenantProviderDomainObservation[];
};

export type TenantProviderPolicyObservation = {
  policyType: 'RETENTION' | 'LEGAL_HOLD';
  ownerService: string;
  coverage: 'GLOBAL';
  revisionNumber: number;
  effectiveState: 'SCHEDULED' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  retentionDays?: number | null;
  legalHoldActive?: boolean | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  publishedAt?: string | null;
  sourceChangedAt: string;
  freshnessState: 'CURRENT_OWNER_REVISION';
  evidenceState: 'NOT_RECORDED' | 'IMPACT_FINGERPRINT_RECORDED';
  impactFingerprint?: string | null;
  sourceVersion: number;
};

export type TenantLifecycleHoldObservation = {
  lifecycleRequestId: string;
  requestedAction: 'RETIRE' | 'PURGE';
  lifecycleState:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED_FOR_HANDOFF'
    | 'REJECTED'
    | 'BLOCKED_BY_HOLD'
    | 'CANCELLED';
  holdEvaluationState: 'OWNER_VERIFICATION_REQUIRED' | 'ACTIVE_GLOBAL_LEGAL_HOLD';
  executionState: 'OWNER_HANDOFF_REQUIRED';
  evidenceReferenceCount: number;
  evidenceState: 'NOT_RECORDED' | 'REFERENCES_REDACTED';
  freshnessState: 'RECORDED_AT';
  sourceChangedAt: string;
  sourceVersion: number;
};

export type TenantProviderDataGovernanceProjection = {
  ownerService: 'provider-control-plane';
  observationState: 'LIVE_OWNER_READ';
  observedAt: string;
  sourceLastChangedAt?: string | null;
  coverageState: 'GLOBAL_POLICIES_AND_CURRENT_TENANT_LIFECYCLE_EVALUATIONS';
  exclusions: string[];
  policies: TenantProviderPolicyObservation[];
  tenantLifecycleHoldObservations: TenantLifecycleHoldObservation[];
};

export type TenantProviderPlanObservation = {
  subscriptionState: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  planKey: string;
  planVersion: number;
  displayName: string;
  startsAt: string;
  endsAt?: string | null;
  sourceVersion: number;
};

export type TenantProviderProductEligibility = {
  productKey: string;
  appResourceKey: string;
  entitlementKey: string;
  entitlementType: 'APP' | 'CAPABILITY' | 'LIMIT';
  eligibilityState:
    | 'ELIGIBLE'
    | 'NO_ACTIVE_SUBSCRIPTION'
    | 'SUBSCRIPTION_SUSPENDED'
    | 'NOT_INCLUDED_IN_PLAN'
    | 'NOT_ASSIGNED_TO_TENANT'
    | 'TENANT_ENTITLEMENT_SUSPENDED'
    | 'CATALOG_RETIRED';
  sourceChangedAt: string;
};

export type TenantProviderPlanEligibilityProjection = {
  ownerService: 'provider-control-plane';
  observationState: 'LIVE_OWNER_READ';
  observedAt: string;
  sourceLastChangedAt?: string | null;
  coverageState: 'CURRENT_SUBSCRIPTION_AND_TENANT_ENTITLEMENTS';
  exclusions: string[];
  plan?: TenantProviderPlanObservation | null;
  products: TenantProviderProductEligibility[];
};

export async function getTenantProviderDomains(
  signal?: AbortSignal
): Promise<TenantProviderDomainProjection> {
  const response = await axiosInstance.get<ApiResponse<TenantProviderDomainProjection>>(
    `${BASE}/provider-domains`,
    signal ? { signal } : undefined
  );
  return response.data.data;
}

export async function getTenantProviderDataGovernance(
  signal?: AbortSignal
): Promise<TenantProviderDataGovernanceProjection> {
  const response = await axiosInstance.get<ApiResponse<TenantProviderDataGovernanceProjection>>(
    `${BASE}/data-governance-observation`,
    signal ? { signal } : undefined
  );
  return response.data.data;
}

export async function getTenantProviderPlanEligibility(
  signal?: AbortSignal
): Promise<TenantProviderPlanEligibilityProjection> {
  const response = await axiosInstance.get<ApiResponse<TenantProviderPlanEligibilityProjection>>(
    `${BASE}/plan-eligibility`,
    signal ? { signal } : undefined
  );
  return response.data.data;
}
