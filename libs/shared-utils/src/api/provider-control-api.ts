import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResult } from './platform-admin-api';

export type ProviderMetric = { key: string; count: number };

export type ProviderEstateOverview = {
  organizations: number;
  tenants: number;
  activeTenants: number;
  provisioningTenants: number;
  suspendedTenants: number;
  failedTenants: number;
  openOperations: number;
  activeSupportSessions: number;
  regions: ProviderMetric[];
  serviceTiers: ProviderMetric[];
};

export type ProviderOperatorProfile = {
  operatorId: number;
  authUserId: number;
  displayName: string;
  roles: string[];
  permissions: string[];
};

export type ProviderEntitlement = {
  entitlementId: number;
  entitlementKey: string;
  name: string;
  entitlementType: string;
  lifecycleState: string;
  configuration: string;
  version: number;
};

export type ProviderServiceInstance = {
  serviceInstanceId: string;
  serviceKey: string;
  serviceName: string;
  deploymentCell?: string | null;
  dataRegion?: string | null;
  lifecycleState: string;
  externalResourceId?: string | null;
  appliedSchemaVersion?: number | null;
  healthSnapshot: string;
  lastReconciledAt?: string | null;
  version: number;
};

export type ProviderTenantDomain = {
  domainId: string;
  domainName: string;
  domainType: string;
  verificationMethod: string;
  verificationState: string;
  primaryDomain: boolean;
  verifiedAt?: string | null;
  lastCheckedAt?: string | null;
  version: number;
};

export type ProviderTenantAdministrator = {
  tenantAdministratorId: string;
  authUserId?: number | null;
  principal: string;
  email?: string | null;
  displayName: string;
  roleCode: string;
  lifecycleState: string;
  primaryAdministrator: boolean;
  lastInvitedAt?: string | null;
  activatedAt?: string | null;
  version: number;
};

export type ProviderTenant = {
  tenantId: string;
  organizationId: string;
  organizationKey: string;
  organizationName: string;
  tenantKey: string;
  displayName: string;
  environmentKey: string;
  serviceTier: 'STANDARD' | 'ENTERPRISE' | 'REGULATED';
  dataRegion: string;
  isolationModel: 'POOL' | 'BRIDGE' | 'SILO';
  defaultLocale: string;
  timeZone: string;
  lifecycleState: string;
  onboardingState: string;
  authTenantId?: number | null;
  schemaVersion: number;
  configuration: string;
  version: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  entitlements: ProviderEntitlement[];
  services: ProviderServiceInstance[];
  domains: ProviderTenantDomain[];
  administrators: ProviderTenantAdministrator[];
};

export type ProviderRegion = {
  regionKey: string;
  displayName: string;
  jurisdictionCode?: string | null;
  residencyClass: string;
  lifecycleState: string;
};

export type ProviderOperationStep = {
  stepId: number;
  order: number;
  stepKey: string;
  lifecycleState: string;
  targetService: string;
  externalReference?: string | null;
  redactedResult: string;
  attemptCount: number;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  nextRetryAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type ProviderOperation = {
  operationId: string;
  tenantId?: string | null;
  operationType: string;
  lifecycleState: string;
  riskTier: string;
  planHash: string;
  plan: string;
  failureCode?: string | null;
  failureMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  version: number;
  steps: ProviderOperationStep[];
};

export type ProviderSupportSession = {
  supportSessionId: string;
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  operatorId: number;
  operatorName: string;
  lifecycleState: string;
  justification: string;
  scopes: string[];
  startedAt: string;
  expiresAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  version: number;
};

export type ProviderSupportSessionGrant = {
  session: ProviderSupportSession;
  sessionToken: string;
};

export type ProviderAuditEvent = {
  auditEventId: string;
  operatorId?: number | null;
  operatorName?: string | null;
  tenantId?: string | null;
  tenantKey?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  outcome: string;
  correlationId?: string | null;
  redactedSnapshot: string;
  occurredAt: string;
};

export type ProviderDomainChallenge = {
  domain: ProviderTenantDomain;
  recordName: string;
  recordType: string;
  recordValue: string;
};

export type ProviderAdministratorInvitation = {
  tenantAdministratorId: string;
  authTenantId: number;
  authUserId: number;
  principal: string;
  activationToken: string;
  activationPath: string;
  expiresAt: string;
};

export type OnboardingPlanRequest = {
  organizationKey: string;
  organizationName: string;
  legalName?: string | null;
  customerReference?: string | null;
  tenantKey: string;
  displayName: string;
  environmentKey: string;
  serviceTier: ProviderTenant['serviceTier'];
  dataRegion: string;
  isolationModel: ProviderTenant['isolationModel'];
  defaultLocale: string;
  timeZone: string;
  primaryDomain?: string | null;
  initialAdminDisplayName: string;
  initialAdminEmail: string;
  initialAdminPrincipal: string;
  entitlementKeys: string[];
  justification: string;
};

const BASE = '/api/provider/v1/admin';

export async function getProviderOperatorProfile(): Promise<ProviderOperatorProfile> {
  const response = await axiosInstance.get<ApiResponse<ProviderOperatorProfile>>(`${BASE}/me`);
  return response.data.data;
}

export async function getProviderEstateOverview(): Promise<ProviderEstateOverview> {
  const response = await axiosInstance.get<ApiResponse<ProviderEstateOverview>>(`${BASE}/overview`);
  return response.data.data;
}

export async function listProviderRegions(): Promise<ProviderRegion[]> {
  const response = await axiosInstance.get<ApiResponse<ProviderRegion[]>>(`${BASE}/regions`);
  return response.data.data;
}

export async function listProviderTenants(
  params: { query?: string; state?: string; page?: number; size?: number } = {}
): Promise<PageResult<ProviderTenant>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 50),
  });
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.state) search.set('state', params.state);
  const response = await axiosInstance.get<ApiResponse<PageResult<ProviderTenant>>>(
    `${BASE}/tenants?${search.toString()}`
  );
  return response.data.data;
}

export async function getProviderTenant(tenantId: string): Promise<ProviderTenant> {
  const response = await axiosInstance.get<ApiResponse<ProviderTenant>>(
    `${BASE}/tenants/${tenantId}`
  );
  return response.data.data;
}

export async function listProviderEntitlements(): Promise<ProviderEntitlement[]> {
  const response = await axiosInstance.get<ApiResponse<ProviderEntitlement[]>>(
    `${BASE}/entitlements`
  );
  return response.data.data;
}

export async function previewProviderOnboarding(
  request: OnboardingPlanRequest
): Promise<ProviderOperation> {
  const response = await axiosInstance.post<ApiResponse<ProviderOperation>, OnboardingPlanRequest>(
    `${BASE}/onboarding-plans`,
    request,
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return response.data.data;
}

export async function executeProviderOperation(
  operation: ProviderOperation
): Promise<ProviderOperation> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderOperation>,
    { planHash: string; version: number }
  >(`${BASE}/operations/${operation.operationId}/execute`, {
    planHash: operation.planHash,
    version: operation.version,
  });
  return response.data.data;
}

export async function retryProviderOperation(
  operation: ProviderOperation,
  justification: string
): Promise<ProviderOperation> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderOperation>,
    { justification: string; version: number }
  >(`${BASE}/operations/${operation.operationId}/retry`, {
    justification,
    version: operation.version,
  });
  return response.data.data;
}

export async function listProviderOperations(): Promise<PageResult<ProviderOperation>> {
  const response = await axiosInstance.get<ApiResponse<PageResult<ProviderOperation>>>(
    `${BASE}/operations?page=0&size=100`
  );
  return response.data.data;
}

export async function updateProviderTenantLifecycle(
  tenant: ProviderTenant,
  state: 'ACTIVE' | 'SUSPENDED',
  justification: string
): Promise<ProviderTenant> {
  const response = await axiosInstance.patch<
    ApiResponse<ProviderTenant>,
    { state: string; justification: string; version: number }
  >(`${BASE}/tenants/${tenant.tenantId}/lifecycle`, {
    state,
    justification,
    version: tenant.version,
  });
  return response.data.data;
}

export async function replaceProviderTenantEntitlements(
  tenant: ProviderTenant,
  entitlementKeys: string[],
  justification: string
): Promise<ProviderTenant> {
  const response = await axiosInstance.put<
    ApiResponse<ProviderTenant>,
    { entitlementKeys: string[]; justification: string; version: number }
  >(`${BASE}/tenants/${tenant.tenantId}/entitlements`, {
    entitlementKeys,
    justification,
    version: tenant.version,
  });
  return response.data.data;
}

export async function createProviderTenantDomain(
  tenantId: string,
  request: { domainName: string; domainType: string; primaryDomain: boolean }
): Promise<ProviderDomainChallenge> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderDomainChallenge>,
    typeof request
  >(`${BASE}/tenants/${tenantId}/domains`, request);
  return response.data.data;
}

export async function getProviderDomainChallenge(
  tenantId: string,
  domainId: string
): Promise<ProviderDomainChallenge> {
  const response = await axiosInstance.get<ApiResponse<ProviderDomainChallenge>>(
    `${BASE}/tenants/${tenantId}/domains/${domainId}/challenge`
  );
  return response.data.data;
}

export async function verifyProviderTenantDomain(
  tenantId: string,
  domain: ProviderTenantDomain,
  justification: string
): Promise<ProviderTenantDomain> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderTenantDomain>,
    { justification: string; version: number }
  >(`${BASE}/tenants/${tenantId}/domains/${domain.domainId}/verify`, {
    justification,
    version: domain.version,
  });
  return response.data.data;
}

export async function issueProviderAdministratorInvitation(
  tenantId: string,
  administratorId: string,
  expiresInMinutes = 1440
): Promise<ProviderAdministratorInvitation> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderAdministratorInvitation>,
    { expiresInMinutes: number; justification: string }
  >(`${BASE}/tenants/${tenantId}/administrators/${administratorId}/invitations`, {
    expiresInMinutes,
    justification: 'Provider-issued initial tenant administrator invitation',
  });
  return response.data.data;
}

export async function listProviderSupportSessions(
  tenantId?: string
): Promise<ProviderSupportSession[]> {
  const search = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const response = await axiosInstance.get<ApiResponse<ProviderSupportSession[]>>(
    `${BASE}/support-sessions${search}`
  );
  return response.data.data;
}

export async function createProviderSupportSession(request: {
  tenantId: string;
  scopes: string[];
  durationMinutes: number;
  justification: string;
}): Promise<ProviderSupportSessionGrant> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSupportSessionGrant>,
    typeof request
  >(`${BASE}/support-sessions`, request);
  return response.data.data;
}

export async function revokeProviderSupportSession(
  session: ProviderSupportSession,
  justification: string
): Promise<ProviderSupportSession> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderSupportSession>,
    { justification: string; version: number }
  >(`${BASE}/support-sessions/${session.supportSessionId}/revoke`, {
    justification,
    version: session.version,
  });
  return response.data.data;
}

export async function listProviderAuditEvents(tenantId?: string): Promise<ProviderAuditEvent[]> {
  const search = new URLSearchParams({ limit: '300' });
  if (tenantId) search.set('tenantId', tenantId);
  const response = await axiosInstance.get<ApiResponse<ProviderAuditEvent[]>>(
    `${BASE}/audit-events?${search.toString()}`
  );
  return response.data.data;
}
