import { axiosInstance } from '../axios-instance';

import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type { ApiResponse } from '../types';

/**
 * The generated Gateway contract is the canonical wire shape. These aliases only make fields
 * required after a successful Provider response, whose Java records always populate them.
 */
type ProviderSchemas = GatewayComponents['schemas'];
type RequiredSchema<T> = Required<T>;

export type ProviderResourceLedgerTotals = RequiredSchema<ProviderSchemas['provider_LedgerTotals']>;
export type ProviderResourceCommitment = Omit<
  RequiredSchema<ProviderSchemas['provider_Commitment']>,
  'activeOverride' | 'controlPeriod' | 'internalEvidenceFreshness' | 'totals'
> & {
  activeOverride: RequiredSchema<ProviderSchemas['provider_ActiveOverride']> | null;
  controlPeriod: Omit<
    RequiredSchema<ProviderSchemas['provider_ControlPeriod']>,
    'endsAt' | 'startsAt'
  > & {
    endsAt: string | null;
    startsAt: string | null;
  };
  internalEvidenceFreshness: Omit<
    RequiredSchema<ProviderSchemas['provider_InternalEvidenceFreshness']>,
    'latestOccurredAt' | 'latestRecordedAt'
  > & {
    latestOccurredAt: string | null;
    latestRecordedAt: string | null;
  };
  totals: ProviderResourceLedgerTotals;
};
export type ProviderResourceCommitmentPage = Omit<
  RequiredSchema<ProviderSchemas['provider_CommitmentPage']>,
  'items'
> & { items: ProviderResourceCommitment[] };
export type ProviderResourceLedgerEntry = RequiredSchema<ProviderSchemas['provider_LedgerEntry']>;
export type ProviderResourceLedgerPage = {
  items: ProviderResourceLedgerEntry[];
  limit: number;
  hasMore: boolean;
};
export type ProviderResourceCommitmentDefinition = Omit<
  RequiredSchema<ProviderSchemas['provider_CommitmentDefinition']>,
  'budgetLimit' | 'currencyCode' | 'quotaLimit'
> & {
  budgetLimit: number | null;
  currencyCode: string | null;
  quotaLimit: number | null;
};
export type ProviderResourceCommitmentChange = Omit<
  RequiredSchema<ProviderSchemas['provider_ResourceCommitmentChange']>,
  | 'baseline'
  | 'baselineCommitmentVersion'
  | 'commercialRenewalRevisionId'
  | 'decidedAt'
  | 'decidedBy'
  | 'decisionReason'
  | 'overrideExpiresAt'
  | 'proposed'
  | 'publishedAt'
  | 'publishedBy'
> & {
  baseline: ProviderResourceCommitmentDefinition | null;
  baselineCommitmentVersion: number | null;
  commercialRenewalRevisionId: string | null;
  decidedAt: string | null;
  decidedBy: number | null;
  decisionReason: string | null;
  overrideExpiresAt: string | null;
  proposed: ProviderResourceCommitmentDefinition;
  publishedAt: string | null;
  publishedBy: number | null;
};
export type ProviderResourceCommitmentChangePage = Omit<
  RequiredSchema<ProviderSchemas['provider_ResourceCommitmentChangePage']>,
  'items'
> & { items: ProviderResourceCommitmentChange[] };
export type ProviderTenantLifecycleRequest = Omit<
  RequiredSchema<ProviderSchemas['provider_TenantLifecycleRequest']>,
  'holdEvidenceRefs'
> & { holdEvidenceRefs: string[] };
export type ProviderTenantLifecycleRequestPage = Omit<
  RequiredSchema<ProviderSchemas['provider_TenantLifecycleRequestPage']>,
  'items'
> & { items: ProviderTenantLifecycleRequest[] };
export type ProviderArtifactReview = RequiredSchema<ProviderSchemas['provider_ArtifactReview']>;
export type ProviderArtifactCompatibilitySummary = Omit<
  RequiredSchema<ProviderSchemas['provider_ArtifactCompatibilitySummary']>,
  'capabilities' | 'clients' | 'dependencies' | 'rollbackReadiness' | 'schema'
> & {
  capabilities: RequiredSchema<ProviderSchemas['provider_ArtifactCapabilityDelta']>;
  clients: Array<RequiredSchema<ProviderSchemas['provider_ArtifactClientCompatibility']>>;
  dependencies: Array<RequiredSchema<ProviderSchemas['provider_ArtifactDependencyCompatibility']>>;
  rollbackReadiness: RequiredSchema<ProviderSchemas['provider_RollbackReadiness']>;
  schema: RequiredSchema<ProviderSchemas['provider_ArtifactSchemaCompatibility']>;
};
export type ProviderArtifactManifest = Omit<
  RequiredSchema<ProviderSchemas['provider_ArtifactManifest']>,
  'compatibility' | 'reviews'
> & { compatibility: ProviderArtifactCompatibilitySummary; reviews: ProviderArtifactReview[] };
export type ProviderArtifactManifestPage = Omit<
  RequiredSchema<ProviderSchemas['provider_ArtifactManifestPage']>,
  'items'
> & { items: ProviderArtifactManifest[] };
export type ProviderArtifactRolloutEvidence = RequiredSchema<
  ProviderSchemas['provider_ArtifactRolloutEvidence']
>;
export type ProviderArtifactRolloutPlan = Omit<
  RequiredSchema<ProviderSchemas['provider_ArtifactRolloutPlan']>,
  'evidence' | 'rollbackReadiness'
> & {
  evidence: ProviderArtifactRolloutEvidence[];
  rollbackReadiness: RequiredSchema<ProviderSchemas['provider_RollbackReadiness']>;
};
export type ProviderArtifactRolloutPlanPage = Omit<
  RequiredSchema<ProviderSchemas['provider_ArtifactRolloutPlanPage']>,
  'items'
> & { items: ProviderArtifactRolloutPlan[] };

type CreateResourceCommitmentChangeRequest =
  ProviderSchemas['provider_CreateResourceCommitmentChangeRequest'];
type ResourceCommitmentChangeDecisionRequest =
  ProviderSchemas['provider_ResourceCommitmentChangeDecisionRequest'];
type CreateArtifactManifestRequest = ProviderSchemas['provider_CreateArtifactManifestRequest'];
type AssessArtifactCompatibilityRequest =
  ProviderSchemas['provider_AssessArtifactCompatibilityRequest'];
type ArtifactReviewDecisionRequest = ProviderSchemas['provider_ArtifactReviewDecisionRequest'];
type CreateArtifactRolloutPlanRequest =
  ProviderSchemas['provider_CreateArtifactRolloutPlanRequest'];
type ArtifactRolloutDecisionRequest = ProviderSchemas['provider_ArtifactRolloutDecisionRequest'];
type AppendArtifactEvidenceRequest = ProviderSchemas['provider_AppendArtifactEvidenceRequest'];
type CreateTenantLifecycleRequest = ProviderSchemas['provider_CreateTenantLifecycleRequest'];
type TenantLifecycleDecisionRequest = ProviderSchemas['provider_TenantLifecycleDecisionRequest'];

type LedgerCommandBase = Omit<
  Required<ProviderSchemas['provider_AppendLedgerEntryRequest']>,
  'entryType' | 'unit' | 'currencyCode'
>;

/** Enforces the internal-only CURRENCY_MINOR rule before the request reaches the API. */
export type ProviderResourceLedgerCommand =
  | (LedgerCommandBase & {
      entryType: 'BUDGET_RESERVE' | 'BUDGET_RELEASE' | 'BUDGET_SPEND';
      unit: 'CURRENCY_MINOR';
      currencyCode: string;
    })
  | (LedgerCommandBase & {
      entryType: 'ALLOCATE' | 'RELEASE' | 'METER' | 'ADJUST';
      unit: string;
      currencyCode?: null;
    });

const BASE = '/api/provider/v1/admin';

export async function listProviderResourceCommitments(
  tenantId?: string
): Promise<ProviderResourceCommitmentPage> {
  const search = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const response = await axiosInstance.get<ApiResponse<ProviderResourceCommitmentPage>>(
    `${BASE}/resource-governance/commitments${search}`
  );
  return response.data.data;
}

export async function listProviderResourceLedger(
  tenantId: string,
  resourceKey: string,
  limit = 100
): Promise<ProviderResourceLedgerPage> {
  const response = await axiosInstance.get<ApiResponse<ProviderResourceLedgerPage>>(
    `${BASE}/resource-governance/tenants/${encodeURIComponent(tenantId)}/commitments/${encodeURIComponent(resourceKey)}/ledger?limit=${limit}`
  );
  return response.data.data;
}

export async function appendProviderResourceLedger(
  tenantId: string,
  resourceKey: string,
  request: ProviderResourceLedgerCommand
): Promise<ProviderResourceLedgerEntry> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderResourceLedgerEntry>,
    typeof request
  >(
    `${BASE}/resource-governance/tenants/${encodeURIComponent(tenantId)}/commitments/${encodeURIComponent(resourceKey)}/ledger`,
    request
  );
  return response.data.data;
}

export async function listProviderResourceCommitmentChanges(
  tenantId?: string
): Promise<ProviderResourceCommitmentChangePage> {
  const search = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const response = await axiosInstance.get<ApiResponse<ProviderResourceCommitmentChangePage>>(
    `${BASE}/resource-governance/commitment-changes${search}`
  );
  return response.data.data;
}

export async function createProviderResourceCommitmentChange(
  tenantId: string,
  resourceKey: string,
  request: CreateResourceCommitmentChangeRequest
): Promise<ProviderResourceCommitmentChange> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderResourceCommitmentChange>,
    typeof request
  >(
    `${BASE}/resource-governance/tenants/${encodeURIComponent(tenantId)}/commitments/${encodeURIComponent(resourceKey)}/changes`,
    request
  );
  return response.data.data;
}

export async function decideProviderResourceCommitmentChange(
  change: ProviderResourceCommitmentChange,
  decision: Omit<ResourceCommitmentChangeDecisionRequest, 'version'>
): Promise<ProviderResourceCommitmentChange> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderResourceCommitmentChange>,
    typeof decision & { version: number }
  >(`${BASE}/resource-governance/commitment-changes/${change.changeRequestId}/decision`, {
    ...decision,
    version: change.version,
  });
  return response.data.data;
}

export async function publishProviderResourceCommitmentChange(
  change: ProviderResourceCommitmentChange,
  reason: string
): Promise<ProviderResourceCommitmentChange> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderResourceCommitmentChange>,
    { version: number; reason: string }
  >(`${BASE}/resource-governance/commitment-changes/${change.changeRequestId}/publish`, {
    version: change.version,
    reason,
  });
  return response.data.data;
}

export async function listProviderTenantLifecycleRequests(
  tenantId?: string
): Promise<ProviderTenantLifecycleRequestPage> {
  const search = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const response = await axiosInstance.get<ApiResponse<ProviderTenantLifecycleRequestPage>>(
    `${BASE}/resource-governance/lifecycle-requests${search}`
  );
  return response.data.data;
}

export async function createProviderTenantLifecycleRequest(
  tenantId: string,
  request: CreateTenantLifecycleRequest
): Promise<ProviderTenantLifecycleRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderTenantLifecycleRequest>,
    typeof request
  >(
    `${BASE}/resource-governance/tenants/${encodeURIComponent(tenantId)}/lifecycle-requests`,
    request
  );
  return response.data.data;
}

async function transitionProviderTenantLifecycleRequest(
  request: ProviderTenantLifecycleRequest,
  action: 'cancel' | 'refresh-hold' | 'submit',
  reason: string
): Promise<ProviderTenantLifecycleRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderTenantLifecycleRequest>,
    { version: number; reason: string }
  >(`${BASE}/resource-governance/lifecycle-requests/${request.lifecycleRequestId}/${action}`, {
    version: request.version,
    reason,
  });
  return response.data.data;
}

export const refreshProviderTenantLifecycleHold = (
  request: ProviderTenantLifecycleRequest,
  reason: string
) => transitionProviderTenantLifecycleRequest(request, 'refresh-hold', reason);

export const submitProviderTenantLifecycleRequest = (
  request: ProviderTenantLifecycleRequest,
  reason: string
) => transitionProviderTenantLifecycleRequest(request, 'submit', reason);

export const cancelProviderTenantLifecycleRequest = (
  request: ProviderTenantLifecycleRequest,
  reason: string
) => transitionProviderTenantLifecycleRequest(request, 'cancel', reason);

export async function decideProviderTenantLifecycleRequest(
  request: ProviderTenantLifecycleRequest,
  decision: Omit<TenantLifecycleDecisionRequest, 'version'>
): Promise<ProviderTenantLifecycleRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderTenantLifecycleRequest>,
    typeof decision & { version: number }
  >(`${BASE}/resource-governance/lifecycle-requests/${request.lifecycleRequestId}/decision`, {
    ...decision,
    version: request.version,
  });
  return response.data.data;
}

export async function listProviderArtifactManifests(): Promise<ProviderArtifactManifestPage> {
  const response = await axiosInstance.get<ApiResponse<ProviderArtifactManifestPage>>(
    `${BASE}/artifact-governance/manifests`
  );
  return response.data.data;
}

export async function createProviderArtifactManifest(
  request: CreateArtifactManifestRequest
): Promise<ProviderArtifactManifest> {
  const response = await axiosInstance.post<ApiResponse<ProviderArtifactManifest>, typeof request>(
    `${BASE}/artifact-governance/manifests`,
    request
  );
  return response.data.data;
}

export async function assessProviderArtifactCompatibility(
  artifact: ProviderArtifactManifest,
  request: Omit<AssessArtifactCompatibilityRequest, 'version'>
): Promise<ProviderArtifactManifest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderArtifactManifest>,
    typeof request & { version: number }
  >(`${BASE}/artifact-governance/manifests/${artifact.artifactId}/compatibility`, {
    ...request,
    version: artifact.version,
  });
  return response.data.data;
}

export async function submitProviderArtifactManifest(
  artifact: ProviderArtifactManifest,
  reason: string
): Promise<ProviderArtifactManifest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderArtifactManifest>,
    { version: number; reason: string }
  >(`${BASE}/artifact-governance/manifests/${artifact.artifactId}/submit`, {
    version: artifact.version,
    reason,
  });
  return response.data.data;
}

export async function decideProviderArtifactManifest(
  artifact: ProviderArtifactManifest,
  request: Omit<ArtifactReviewDecisionRequest, 'version'>
): Promise<ProviderArtifactManifest> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderArtifactManifest>,
    typeof request & { version: number }
  >(`${BASE}/artifact-governance/manifests/${artifact.artifactId}/review`, {
    version: artifact.version,
    ...request,
  });
  return response.data.data;
}

export async function listProviderArtifactRolloutPlans(): Promise<ProviderArtifactRolloutPlanPage> {
  const response = await axiosInstance.get<ApiResponse<ProviderArtifactRolloutPlanPage>>(
    `${BASE}/artifact-governance/rollout-plans`
  );
  return response.data.data;
}

export async function createProviderArtifactRolloutPlan(
  request: CreateArtifactRolloutPlanRequest
): Promise<ProviderArtifactRolloutPlan> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderArtifactRolloutPlan>,
    typeof request
  >(`${BASE}/artifact-governance/rollout-plans`, request);
  return response.data.data;
}

async function transitionProviderArtifactPlan(
  plan: ProviderArtifactRolloutPlan,
  action: 'submit' | 'ready',
  reason: string
): Promise<ProviderArtifactRolloutPlan> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderArtifactRolloutPlan>,
    { version: number; reason: string }
  >(`${BASE}/artifact-governance/rollout-plans/${plan.rolloutPlanId}/${action}`, {
    version: plan.version,
    reason,
  });
  return response.data.data;
}

export const submitProviderArtifactRolloutPlan = (
  plan: ProviderArtifactRolloutPlan,
  reason: string
) => transitionProviderArtifactPlan(plan, 'submit', reason);

export const markProviderArtifactRolloutPlanReady = (
  plan: ProviderArtifactRolloutPlan,
  reason: string
) => transitionProviderArtifactPlan(plan, 'ready', reason);

export async function decideProviderArtifactRolloutPlan(
  plan: ProviderArtifactRolloutPlan,
  request: Omit<ArtifactRolloutDecisionRequest, 'version'>
): Promise<ProviderArtifactRolloutPlan> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderArtifactRolloutPlan>,
    typeof request & { version: number }
  >(`${BASE}/artifact-governance/rollout-plans/${plan.rolloutPlanId}/approval`, {
    version: plan.version,
    ...request,
  });
  return response.data.data;
}

export async function appendProviderArtifactRolloutEvidence(
  plan: ProviderArtifactRolloutPlan,
  request: AppendArtifactEvidenceRequest
): Promise<ProviderArtifactRolloutEvidence> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderArtifactRolloutEvidence>,
    typeof request
  >(`${BASE}/artifact-governance/rollout-plans/${plan.rolloutPlanId}/evidence`, request);
  return response.data.data;
}
