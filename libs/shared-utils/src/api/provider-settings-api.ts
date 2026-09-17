import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const BASE = '/api/provider/v1/admin/settings';

export type ProviderSettingScopeType = 'USER' | 'TENANT' | 'PROVIDER' | 'APPLICATION';

export type ProviderSettingDefinition = {
  settingId: string;
  displayName: string;
  description: string;
  owner: {
    service: string;
    domain: string;
    readPermission: string;
    managementPath: string;
  };
  supportedScopes: ProviderSettingScopeType[];
  validation: {
    valueType: 'BOOLEAN' | 'STRING' | 'NUMBER' | 'OBJECT' | 'ARRAY' | 'JSON';
    schemaVersion: string;
    schema: unknown;
    ownerRevalidatesOnWrite: boolean;
  };
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';
  change: {
    riskTier: string;
    workflow: 'DIRECT' | 'REVIEW_AND_PUBLISH' | 'APPROVE_AND_ACTIVATE' | 'OWNER_MANAGED';
    approvalRequired: boolean;
    activationRequired: boolean;
  };
  lifecycleState: 'ACTIVE' | 'DEPRECATED' | 'UNAVAILABLE';
  definitionVersion: number;
};

export type ProviderSettingProvenance = {
  precedence: number;
  sourceType:
    | 'DEFAULT'
    | 'PROVIDER_POLICY'
    | 'TENANT_POLICY'
    | 'USER_PREFERENCE'
    | 'ACTIVE_ROLLOUT'
    | 'APPLICATION_OVERRIDE';
  sourceScope: ProviderSettingScopeType;
  sourceId: string;
  version: string;
  locked: boolean;
  decisionCode: string;
  decidedAt: string;
};

export type ProviderSettingApplicationState =
  | 'NOT_CONFIGURED'
  | 'DRAFT'
  | 'APPROVAL_PENDING'
  | 'READY_TO_PUBLISH'
  | 'PUBLISH_PENDING'
  | 'OBSERVATION_UNSUPPORTED'
  | 'PUBLISHED_UNOBSERVED'
  | 'APPLYING'
  | 'CONVERGED'
  | 'PARTIAL'
  | 'DRIFTED'
  | 'FAILED'
  | 'OBSERVATION_STALE';

export type ProviderSettingApplicationStatus = {
  state: ProviderSettingApplicationState;
  desiredState:
    | 'NONE'
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'PUBLISH_REQUESTED'
    | 'PUBLISHED'
    | 'FAILED';
  desiredVersion: string | null;
  publishedVersion: string | null;
  uniformlyObservedVersion: string | null;
  expectedTargetCount: number;
  observedTargetCount: number;
  convergedTargetCount: number;
  failedTargetCount: number;
  driftedTargetCount: number;
  publishAcceptedAt: string | null;
  latestObservationAt: string | null;
  stale: boolean;
};

export type ProviderSettingResolution = {
  settingId: string;
  resolutionState:
    'RESOLVED' | 'REDACTED' | 'UNSUPPORTED_SETTING' | 'UNSUPPORTED_SCOPE' | 'VALUE_UNAVAILABLE';
  definition: ProviderSettingDefinition | null;
  target: {
    scopeType: ProviderSettingScopeType;
    scopeId: string;
    environment: string | null;
  };
  effectiveValue: unknown | null;
  effectiveVersion: string | null;
  provenance: ProviderSettingProvenance[];
  applicationStatus: ProviderSettingApplicationStatus | null;
  reasonCode: string;
  resolvedAt: string;
};

export async function listProviderSettings(
  params: {
    query?: string;
    ownerService?: string;
    scopeType?: ProviderSettingScopeType;
  } = {},
  signal?: AbortSignal
): Promise<ProviderSettingDefinition[]> {
  const search = new URLSearchParams();
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.ownerService?.trim()) search.set('ownerService', params.ownerService.trim());
  if (params.scopeType) search.set('scopeType', params.scopeType);
  const query = search.toString();
  const response = await axiosInstance.get<ApiResponse<ProviderSettingDefinition[]>>(
    `${BASE}${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
  return response.data.data;
}

export async function getProviderEffectiveSetting(
  settingId: string,
  target: {
    scopeType: ProviderSettingScopeType;
    scopeId: string;
    environment?: string;
  },
  signal?: AbortSignal
): Promise<ProviderSettingResolution> {
  const normalizedSettingId = settingId.trim();
  const normalizedScopeId = target.scopeId.trim();
  if (!normalizedSettingId) throw new Error('settingId is required.');
  if (!normalizedScopeId) throw new Error('scopeId is required.');

  const search = new URLSearchParams({
    scopeType: target.scopeType,
    scopeId: normalizedScopeId,
  });
  if (target.environment?.trim()) search.set('environment', target.environment.trim());
  const response = await axiosInstance.get<ApiResponse<ProviderSettingResolution>>(
    `${BASE}/${encodeURIComponent(normalizedSettingId)}/effective?${search.toString()}`,
    signal ? { signal } : undefined
  );
  return response.data.data;
}
