import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  EffectiveWidgetCatalog,
  TenantWidgetCatalog,
  TenantWidgetExplain,
  TenantWidgetPolicy,
  TenantWidgetPolicyImpact,
  TenantWidgetPolicyRevision,
  WidgetAuditEvent,
  WidgetCommandHeaders,
  WidgetDefinition,
  WidgetDefinitionRetirementImpact,
  WidgetEvidence,
  WidgetMutationReason,
  WidgetRegistryPage,
  WidgetRegistryReadiness,
  WidgetReleaseChannel,
  WidgetReleaseChannelHead,
  WidgetRuntimeControl,
  WidgetRuntimeEnableApproval,
  WidgetValidation,
  WidgetVersion,
} from './widget-registry-contract';
import type { HomeExperienceVariant } from './home-experience-api';

const PROVIDER_BASE = '/api/provider/v1/admin';
const TENANT_BASE = '/api/platform/v1/admin';
const MEMBER_BASE = '/api/platform/v1/widget-catalog';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type WidgetRegistryPageQuery = Readonly<{
  page?: number;
  size?: number;
}>;

export type WidgetDefinitionListQuery = WidgetRegistryPageQuery &
  Readonly<{ definitionState?: WidgetDefinition['definitionState'] }>;

export type WidgetVersionListQuery = WidgetRegistryPageQuery;

export type WidgetEvidenceListQuery = WidgetRegistryPageQuery;

export type TenantWidgetCatalogQuery = Readonly<{ surfaceKey?: 'workspace-home' }>;

export type WidgetRuntimeControlListQuery = WidgetRegistryPageQuery;

export type WidgetTransitionRequest = WidgetMutationReason;
export type WidgetPublishRequest = WidgetMutationReason &
  Readonly<{
    channel: WidgetReleaseChannel;
    validationRunId: string;
    evidenceIds: readonly string[];
    manifestHash: string;
    expectedImpactRevision: string;
  }>;
export type WidgetDeprecateRequest = WidgetMutationReason &
  Readonly<{ replacementVersionId: string; deprecationEndsAt: string }>;
export type WidgetSafetyTransitionRequest = WidgetMutationReason &
  Readonly<{
    publicReasonCode: string;
    internalIncidentRef: string;
    replacementVersionId?: string | null;
    expiresAt?: string | null;
    expectedImpactRevision: string;
  }>;
export type WidgetChannelRollbackRequest = WidgetMutationReason &
  Readonly<{
    restoreVersionId: string;
    expectedCurrentVersionId: string;
    expectedImpactRevision: string;
  }>;
export type TenantPolicyPublishRequest = WidgetMutationReason &
  Readonly<{ expectedImpactRevision: string }>;
export type TenantPolicyRevokeRequest = WidgetMutationReason &
  Readonly<{ expectedImpactRevision: string }>;
export type TenantPolicyRollbackRequest = WidgetMutationReason &
  Readonly<{ restoreRevisionId: string; expectedImpactRevision: string }>;
export type WidgetReviewDecisionRequest = WidgetMutationReason &
  Readonly<{
    decision: 'APPROVE' | 'REJECT';
    validationRunId: string;
    evidenceIds: readonly string[];
  }>;
export type WidgetRuntimeDisableRequest = WidgetMutationReason &
  Readonly<{
    scope: WidgetRuntimeControl['scope'];
    targetType: WidgetRuntimeControl['targetType'];
    targetId?: string | null;
    tenantId?: number | null;
    providerProductKey?: string | null;
    expiresAt?: string | null;
    publicReasonCode: string;
    internalIncidentRef: string;
  }>;
export type WidgetRuntimeEnableApprovalRequest = WidgetMutationReason &
  Readonly<{ controlRevision: number; evidenceRefs: readonly string[] }>;
export type WidgetRuntimeEnableRequest = WidgetMutationReason &
  Readonly<{ enableApprovalId: string; controlRevision: number }>;
export type TenantPolicyRevisionRequest = WidgetMutationReason &
  Readonly<{
    enabled: boolean;
    selector: 'CHANNEL' | 'PINNED';
    channel: WidgetReleaseChannel | null;
    versionId: string | null;
    supportedSurfaceKeys: readonly string[];
    audienceSelector: Readonly<Record<string, unknown>>;
    required: boolean;
    lockedConfiguration: Readonly<Record<string, unknown>>;
    sharingPolicy: 'PRIVATE' | 'TENANT' | 'DISABLED';
  }>;

function appendQuery(url: string, query: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const suffix = search.toString();
  return suffix ? `${url}?${suffix}` : url;
}

function commandConfig(headers: WidgetCommandHeaders) {
  if (!UUID_PATTERN.test(headers.idempotencyKey) || !UUID_PATTERN.test(headers.correlationId)) {
    throw new Error('Widget registry commands require UUID idempotency and correlation keys.');
  }
  return {
    headers: {
      'Idempotency-Key': headers.idempotencyKey,
      'X-Correlation-ID': headers.correlationId,
    },
  };
}

export function createWidgetRegistryCommandHeaders(): WidgetCommandHeaders {
  return { idempotencyKey: crypto.randomUUID(), correlationId: crypto.randomUUID() };
}

export async function getWidgetRegistryReadiness(): Promise<WidgetRegistryReadiness> {
  const response = await axiosInstance.get<ApiResponse<WidgetRegistryReadiness>>(
    `${MEMBER_BASE}/readiness`
  );
  return response.data.data;
}

export async function getProviderWidgetRegistryReadiness(): Promise<WidgetRegistryReadiness> {
  const response = await axiosInstance.get<ApiResponse<WidgetRegistryReadiness>>(
    `${PROVIDER_BASE}/widget-registry/readiness`
  );
  return response.data.data;
}

export async function getEffectiveWidgetCatalog(
  surfaceKey: 'workspace-home',
  mode: HomeExperienceVariant
): Promise<EffectiveWidgetCatalog> {
  const response = await axiosInstance.get<ApiResponse<EffectiveWidgetCatalog>>(
    appendQuery(`${MEMBER_BASE}/effective`, { surfaceKey, mode })
  );
  return response.data.data;
}

export async function listWidgetDefinitions(
  query: WidgetDefinitionListQuery = {}
): Promise<WidgetRegistryPage<WidgetDefinition>> {
  const response = await axiosInstance.get<ApiResponse<WidgetRegistryPage<WidgetDefinition>>>(
    appendQuery(`${PROVIDER_BASE}/widget-definitions`, query)
  );
  return response.data.data;
}

export async function getWidgetDefinition(definitionId: string): Promise<WidgetDefinition> {
  const response = await axiosInstance.get<ApiResponse<WidgetDefinition>>(
    `${PROVIDER_BASE}/widget-definitions/${encodeURIComponent(definitionId)}`
  );
  return response.data.data;
}

export async function listWidgetDefinitionVersions(
  definitionId: string,
  query: WidgetVersionListQuery = {}
): Promise<WidgetRegistryPage<WidgetVersion>> {
  const response = await axiosInstance.get<ApiResponse<WidgetRegistryPage<WidgetVersion>>>(
    appendQuery(
      `${PROVIDER_BASE}/widget-definitions/${encodeURIComponent(definitionId)}/versions`,
      query
    )
  );
  return response.data.data;
}

export async function getWidgetDefinitionVersion(versionId: string): Promise<WidgetVersion> {
  const response = await axiosInstance.get<ApiResponse<WidgetVersion>>(
    `${PROVIDER_BASE}/widget-definition-versions/${encodeURIComponent(versionId)}`
  );
  return response.data.data;
}

export async function listWidgetCertificationEvidence(
  versionId: string,
  query: WidgetEvidenceListQuery = {}
): Promise<WidgetRegistryPage<WidgetEvidence>> {
  const response = await axiosInstance.get<ApiResponse<WidgetRegistryPage<WidgetEvidence>>>(
    appendQuery(
      `${PROVIDER_BASE}/widget-definition-versions/${encodeURIComponent(versionId)}/evidence`,
      query
    )
  );
  return response.data.data;
}

export async function getWidgetDefinitionRetirementImpact(
  definitionId: string,
  replacementDefinitionId?: string
): Promise<WidgetDefinitionRetirementImpact> {
  const response = await axiosInstance.get<ApiResponse<WidgetDefinitionRetirementImpact>>(
    appendQuery(
      `${PROVIDER_BASE}/widget-definitions/${encodeURIComponent(definitionId)}/retirement-impact`,
      { replacementDefinitionId }
    )
  );
  return response.data.data;
}

export async function getWidgetVersionImpact(
  versionId: string,
  operation: 'PUBLISH' | 'BLOCK' | 'QUARANTINE' | 'REVOKE' | 'PROMOTE' | 'ROLLBACK'
): Promise<WidgetDefinitionRetirementImpact> {
  const response = await axiosInstance.get<ApiResponse<WidgetDefinitionRetirementImpact>>(
    appendQuery(
      `${PROVIDER_BASE}/widget-definition-versions/${encodeURIComponent(versionId)}/impact`,
      { operation }
    )
  );
  return response.data.data;
}

export async function getWidgetReleaseChannel(
  definitionId: string,
  channel: WidgetReleaseChannel
): Promise<WidgetReleaseChannelHead> {
  const response = await axiosInstance.get<ApiResponse<WidgetReleaseChannelHead>>(
    `${PROVIDER_BASE}/widget-definitions/${encodeURIComponent(definitionId)}/channels/${channel}`
  );
  return response.data.data;
}

export async function listWidgetRuntimeControls(
  query: WidgetRuntimeControlListQuery = {}
): Promise<WidgetRegistryPage<WidgetRuntimeControl>> {
  const response = await axiosInstance.get<ApiResponse<WidgetRegistryPage<WidgetRuntimeControl>>>(
    appendQuery(`${PROVIDER_BASE}/widget-runtime-controls`, query)
  );
  return response.data.data;
}

export async function listWidgetAuditEvents(
  query: WidgetRegistryPageQuery = {}
): Promise<WidgetRegistryPage<WidgetAuditEvent>> {
  const response = await axiosInstance.get<ApiResponse<WidgetRegistryPage<WidgetAuditEvent>>>(
    appendQuery(`${PROVIDER_BASE}/widget-registry/events`, query)
  );
  return response.data.data;
}

async function postVersionTransition<Request extends WidgetMutationReason>(
  versionId: string,
  action: string,
  request: Request,
  headers: WidgetCommandHeaders
): Promise<WidgetVersion> {
  const response = await axiosInstance.post<ApiResponse<WidgetVersion>, Request>(
    `${PROVIDER_BASE}/widget-definition-versions/${encodeURIComponent(versionId)}/${action}`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}

export async function validateWidgetDefinitionVersion(
  versionId: string,
  request: WidgetMutationReason & Readonly<{ manifestHash: string }>,
  headers: WidgetCommandHeaders
): Promise<WidgetValidation> {
  const response = await axiosInstance.post<ApiResponse<WidgetValidation>, typeof request>(
    `${PROVIDER_BASE}/widget-definition-versions/${encodeURIComponent(versionId)}/validate`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}

export function submitWidgetDefinitionVersion(
  versionId: string,
  request: WidgetTransitionRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetVersion> {
  return postVersionTransition(versionId, 'submit', request, headers);
}

export function decideWidgetDefinitionVersion(
  versionId: string,
  request: WidgetReviewDecisionRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetVersion> {
  return postVersionTransition(versionId, 'decision', request, headers);
}

export function reworkWidgetDefinitionVersion(
  versionId: string,
  request: WidgetTransitionRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetVersion> {
  return postVersionTransition(versionId, 'rework', request, headers);
}

export function publishWidgetDefinitionVersion(
  versionId: string,
  request: WidgetPublishRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetVersion> {
  return postVersionTransition(versionId, 'publish', request, headers);
}

export function deprecateWidgetDefinitionVersion(
  versionId: string,
  request: WidgetDeprecateRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetVersion> {
  return postVersionTransition(versionId, 'deprecate', request, headers);
}

export function quarantineWidgetDefinitionVersion(
  versionId: string,
  request: WidgetSafetyTransitionRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetVersion> {
  return postVersionTransition(versionId, 'quarantine', request, headers);
}

export function blockWidgetDefinitionVersion(
  versionId: string,
  request: WidgetSafetyTransitionRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetVersion> {
  return postVersionTransition(versionId, 'block', request, headers);
}

export function revokeWidgetDefinitionVersion(
  versionId: string,
  request: WidgetSafetyTransitionRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetVersion> {
  return postVersionTransition(versionId, 'revoke', request, headers);
}

export async function rollbackWidgetReleaseChannel(
  definitionId: string,
  channel: WidgetReleaseChannel,
  request: WidgetChannelRollbackRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetReleaseChannelHead> {
  const response = await axiosInstance.post<
    ApiResponse<WidgetReleaseChannelHead>,
    WidgetChannelRollbackRequest
  >(
    `${PROVIDER_BASE}/widget-definitions/${encodeURIComponent(definitionId)}/channels/${channel}/rollback`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}

export async function getTenantWidgetCatalog(
  query: TenantWidgetCatalogQuery = {}
): Promise<TenantWidgetCatalog> {
  const response = await axiosInstance.get<ApiResponse<TenantWidgetCatalog>>(
    appendQuery(`${TENANT_BASE}/widget-catalog`, query)
  );
  return response.data.data;
}

export async function getTenantWidgetPolicy(definitionId: string): Promise<TenantWidgetPolicy> {
  const response = await axiosInstance.get<ApiResponse<TenantWidgetPolicy>>(
    `${TENANT_BASE}/widget-policies/${encodeURIComponent(definitionId)}`
  );
  return response.data.data;
}

export async function listTenantPolicyHistory(
  definitionId: string,
  query: WidgetRegistryPageQuery = {}
): Promise<WidgetRegistryPage<TenantWidgetPolicyRevision>> {
  const response = await axiosInstance.get<
    ApiResponse<WidgetRegistryPage<TenantWidgetPolicyRevision>>
  >(
    appendQuery(`${TENANT_BASE}/widget-policies/${encodeURIComponent(definitionId)}/history`, query)
  );
  return response.data.data;
}

export async function previewTenantPolicyImpact(
  definitionId: string,
  revisionId: string
): Promise<TenantWidgetPolicyImpact> {
  const response = await axiosInstance.get<ApiResponse<TenantWidgetPolicyImpact>>(
    `${TENANT_BASE}/widget-policies/${encodeURIComponent(definitionId)}/revisions/${encodeURIComponent(revisionId)}/impact`
  );
  return response.data.data;
}

export async function explainTenantWidgetDecision(
  definitionId: string,
  surfaceKey: 'workspace-home'
): Promise<TenantWidgetExplain> {
  const response = await axiosInstance.get<ApiResponse<TenantWidgetExplain>>(
    appendQuery(`${TENANT_BASE}/widget-catalog/${encodeURIComponent(definitionId)}/explain`, {
      surfaceKey,
    })
  );
  return response.data.data;
}

export async function createTenantPolicyRevision(
  definitionId: string,
  request: TenantPolicyRevisionRequest,
  headers: WidgetCommandHeaders
): Promise<TenantWidgetPolicyRevision> {
  const response = await axiosInstance.post<
    ApiResponse<TenantWidgetPolicyRevision>,
    TenantPolicyRevisionRequest
  >(
    `${TENANT_BASE}/widget-policies/${encodeURIComponent(definitionId)}/revisions`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}

export async function updateTenantPolicyRevision(
  definitionId: string,
  revisionId: string,
  request: TenantPolicyRevisionRequest,
  headers: WidgetCommandHeaders
): Promise<TenantWidgetPolicyRevision> {
  const response = await axiosInstance.put<
    ApiResponse<TenantWidgetPolicyRevision>,
    TenantPolicyRevisionRequest
  >(
    `${TENANT_BASE}/widget-policies/${encodeURIComponent(definitionId)}/revisions/${encodeURIComponent(revisionId)}`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}

export async function publishTenantPolicyRevision(
  definitionId: string,
  revisionId: string,
  request: TenantPolicyPublishRequest,
  headers: WidgetCommandHeaders
): Promise<TenantWidgetPolicy> {
  const response = await axiosInstance.post<
    ApiResponse<TenantWidgetPolicy>,
    TenantPolicyPublishRequest
  >(
    `${TENANT_BASE}/widget-policies/${encodeURIComponent(definitionId)}/revisions/${encodeURIComponent(revisionId)}/publish`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}

export async function revokeTenantWidgetPolicy(
  definitionId: string,
  request: TenantPolicyRevokeRequest,
  headers: WidgetCommandHeaders
): Promise<TenantWidgetPolicy> {
  const response = await axiosInstance.post<
    ApiResponse<TenantWidgetPolicy>,
    TenantPolicyRevokeRequest
  >(
    `${TENANT_BASE}/widget-policies/${encodeURIComponent(definitionId)}/revoke`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}

export async function rollbackTenantWidgetPolicy(
  definitionId: string,
  request: TenantPolicyRollbackRequest,
  headers: WidgetCommandHeaders
): Promise<TenantWidgetPolicy> {
  const response = await axiosInstance.post<
    ApiResponse<TenantWidgetPolicy>,
    TenantPolicyRollbackRequest
  >(
    `${TENANT_BASE}/widget-policies/${encodeURIComponent(definitionId)}/rollback`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}

export async function disableWidgetRuntime(
  request: WidgetRuntimeDisableRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetRuntimeControl> {
  const response = await axiosInstance.post<
    ApiResponse<WidgetRuntimeControl>,
    WidgetRuntimeDisableRequest
  >(`${PROVIDER_BASE}/widget-runtime-controls/disable`, request, commandConfig(headers));
  return response.data.data;
}

export async function approveWidgetRuntimeEnable(
  controlId: string,
  request: WidgetRuntimeEnableApprovalRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetRuntimeEnableApproval> {
  const response = await axiosInstance.post<
    ApiResponse<WidgetRuntimeEnableApproval>,
    WidgetRuntimeEnableApprovalRequest
  >(
    `${PROVIDER_BASE}/widget-runtime-controls/${encodeURIComponent(controlId)}/enable-approvals`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}

export async function enableWidgetRuntime(
  controlId: string,
  request: WidgetRuntimeEnableRequest,
  headers: WidgetCommandHeaders
): Promise<WidgetRuntimeControl> {
  const response = await axiosInstance.post<
    ApiResponse<WidgetRuntimeControl>,
    WidgetRuntimeEnableRequest
  >(
    `${PROVIDER_BASE}/widget-runtime-controls/${encodeURIComponent(controlId)}/enable`,
    request,
    commandConfig(headers)
  );
  return response.data.data;
}
