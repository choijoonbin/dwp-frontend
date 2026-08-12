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

export type ProviderActionItem = {
  itemId: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  tenantId?: string | null;
  targetId: string;
  createdAt: string;
  route: string;
};

export type ProviderRecentActivity = {
  auditEventId: string;
  action: string;
  category: string;
  outcome: string;
  operatorName?: string | null;
  tenantKey?: string | null;
  targetType: string;
  targetId: string;
  occurredAt: string;
};

export type ProviderServicePosture = {
  serviceKey: string;
  displayName: string;
  criticality: string;
  totalInstances: number;
  healthyInstances: number;
  pendingInstances: number;
  degradedInstances: number;
  failedInstances: number;
  impactedTenants: number;
  lastReconciledAt?: string | null;
};

export type ProviderCellPosture = {
  deploymentCellId: string;
  cellKey: string;
  displayName: string;
  regionKey: string;
  lifecycleState: string;
  placementCapacity: number;
  tenantCount: number;
  serviceInstances: number;
  healthyInstances: number;
  saturationPct: number;
  healthState: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
};

export type ProviderCommandCenter = {
  generatedAt: string;
  operatingState: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
  estate: ProviderEstateOverview;
  activeIncidents: number;
  expiringSubscriptions: number;
  actionQueue: ProviderActionItem[];
  services: ProviderServicePosture[];
  cells: ProviderCellPosture[];
  recentActivity: ProviderRecentActivity[];
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
  email: string;
  displayName: string;
  roleCode: string;
  lifecycleState: string;
  primaryAdministrator: boolean;
  lastInvitedAt?: string | null;
  activatedAt?: string | null;
  version: number;
};

export type ProviderOrganizationSubscription = {
  subscriptionId: string;
  planKey: string;
  planVersion: number;
  planName: string;
  lifecycleState: string;
  startsAt: string;
  endsAt?: string | null;
  contractReference?: string | null;
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
  subscription?: ProviderOrganizationSubscription | null;
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
  attempts: ProviderOperationStepAttempt[];
};

export type ProviderOperationStepAttempt = {
  attemptId: string;
  attemptNumber: number;
  lifecycleState: string;
  requestFingerprint: string;
  redactedResult: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt: string;
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

export type ProviderOperationApproval = {
  operationApprovalId: string;
  operationId: string;
  tenantId?: string | null;
  tenantName?: string | null;
  operationType: string;
  riskTier: string;
  gateKey: string;
  gateOrder: number;
  lifecycleState: string;
  requiredRoleCode: string;
  separationOfDuties: boolean;
  requestedBy: number;
  requestedByName: string;
  decidedBy?: number | null;
  decidedByName?: string | null;
  requestReason: string;
  decisionReason?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  expiresAt: string;
  version: number;
};

export type ProviderIncidentUpdate = {
  incidentUpdateId: string;
  lifecycleState: string;
  message: string;
  visibility: string;
  operatorName?: string | null;
  createdAt: string;
};

export type ProviderServiceIncident = {
  incidentId: string;
  incidentKey: string;
  title: string;
  severity: 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
  lifecycleState: string;
  impactScope: string;
  serviceKey?: string | null;
  regionKey?: string | null;
  deploymentCellId?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
  customerImpact: string;
  publicSummary?: string | null;
  ownerName?: string | null;
  detectedAt: string;
  startedAt: string;
  resolvedAt?: string | null;
  version: number;
  updates: ProviderIncidentUpdate[];
};

export type ProviderServiceHealthOverview = {
  generatedAt: string;
  operatingState: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
  totalInstances: number;
  healthyInstances: number;
  pendingInstances: number;
  degradedInstances: number;
  failedInstances: number;
  impactedTenants: number;
  services: ProviderServicePosture[];
  cells: ProviderCellPosture[];
  incidents: ProviderServiceIncident[];
};

export type ProviderServiceLevelObjective = {
  objectiveId: string;
  objectiveKey: string;
  displayName: string;
  serviceKey: string;
  serviceName: string;
  criticality: string;
  indicatorType: string;
  scopeType: string;
  scopeLabel: string;
  targetPct: number;
  complianceWindowDays: number;
  achievedPct?: number | null;
  errorBudgetRemainingPct?: number | null;
  burnRate?: number | null;
  complianceState: 'HEALTHY' | 'AT_RISK' | 'EXHAUSTED' | 'NO_DATA';
  measurementSource?: string | null;
  observedAt?: string | null;
};

export type ProviderGovernanceDrift = {
  evaluationId: string;
  controlKey: string;
  controlName: string;
  controlCategory: string;
  controlBehavior: string;
  guidanceLevel: string;
  riskTier: string;
  targetType: string;
  targetId: string;
  tenantId?: string | null;
  tenantName?: string | null;
  evaluationResult: string;
  expectedSnapshot: string;
  observedSnapshot: string;
  remediationOperationType?: string | null;
  evaluatedAt: string;
};

export type ProviderMaintenanceWindow = {
  maintenanceWindowId: string;
  operationId: string;
  trackingKey: string;
  title: string;
  summary: string;
  scopeType: string;
  scopeLabel: string;
  impactType: string;
  expectedImpactSeconds: number;
  lifecycleState: string;
  startsAt: string;
  endsAt: string;
  customerNoticeAt?: string | null;
  minimumNoticeHours: number;
  noticeCompliant: boolean;
  version: number;
};

export type ProviderReliabilityControl = {
  generatedAt: string;
  healthyObjectives: number;
  atRiskObjectives: number;
  exhaustedObjectives: number;
  openDriftFindings: number;
  upcomingMaintenance: number;
  objectives: ProviderServiceLevelObjective[];
  driftFindings: ProviderGovernanceDrift[];
  maintenanceWindows: ProviderMaintenanceWindow[];
};

export type ProviderServicePlanPortfolio = {
  planKey: string;
  planVersion: number;
  planName: string;
  serviceTier: string;
  lifecycleState: string;
  organizations: number;
  tenants: number;
};

export type ProviderSubscriptionPortfolio = {
  subscriptionId: string;
  organizationId: string;
  organizationKey: string;
  organizationName: string;
  planKey: string;
  planName: string;
  serviceTier: string;
  lifecycleState: string;
  startsAt: string;
  endsAt?: string | null;
  contractReference?: string | null;
  tenants: number;
  activeEntitlements: number;
};

export type ProviderEntitlementAdoption = {
  entitlementId: number;
  entitlementKey: string;
  name: string;
  entitlementType: string;
  assignedTenants: number;
  eligibleTenants: number;
};

export type ProviderCommercialOverview = {
  generatedAt: string;
  activeSubscriptions: number;
  trialSubscriptions: number;
  expiringSubscriptions: number;
  uncontractedOrganizations: number;
  plans: ProviderServicePlanPortfolio[];
  subscriptions: ProviderSubscriptionPortfolio[];
  entitlements: ProviderEntitlementAdoption[];
};

export type ProviderAuditInsights = {
  generatedAt: string;
  events24Hours: number;
  failed24Hours: number;
  denied24Hours: number;
  privilegedAccess24Hours: number;
  outcomes: ProviderMetric[];
  categories: ProviderMetric[];
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
  accessMode: 'STANDARD' | 'BREAK_GLASS';
  approvalReference?: string | null;
  customerApprovalRequired: boolean;
  riskTier: 'L1' | 'L2' | 'L3';
  startedAt: string;
  expiresAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  version: number;
};

export type ProviderSupportScope = {
  scopeCode: string;
  displayName: string;
  riskTier: 'L1' | 'L2' | 'L3';
  requiresCustomerApproval: boolean;
  lifecycleState: string;
};

export type ProviderSupportSessionContext = {
  supportSessionId: string;
  tenantId: string;
  authTenantId: number;
  tenantKey: string;
  tenantName: string;
  scopes: string[];
  accessMode: 'STANDARD' | 'BREAK_GLASS';
  expiresAt: string;
  version: number;
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
  eventCategory: string;
  outcome: string;
  correlationId?: string | null;
  redactedSnapshot: string;
  occurredAt: string;
};

export type ProviderDataGovernanceSummary = {
  databases: number;
  availableDatabases: number;
  logicalTables: number;
  partitions: number;
  columns: number;
  foreignKeys: number;
  documentedAssets: number;
  reviewRequired: number;
  totalBytes: number;
};

export type ProviderDatabaseAssetSummary = {
  databaseKey: string;
  databaseName: string;
  displayName: string;
  ownerService: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  error?: string | null;
  logicalTables: number;
  partitions: number;
  views: number;
  columns: number;
  foreignKeys: number;
  documentedAssets: number;
  totalAssets: number;
  totalBytes: number;
  businessDomains: string[];
};

export type ProviderDataColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string | null;
  description?: string | null;
  primaryKey: boolean;
  foreignKey: boolean;
  indexed: boolean;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
};

export type ProviderDataAsset = {
  assetKey: string;
  databaseKey: string;
  databaseName: string;
  schemaName: string;
  objectName: string;
  objectType:
    'TABLE' | 'PARTITIONED_TABLE' | 'PARTITION' | 'VIEW' | 'MATERIALIZED_VIEW' | 'SYSTEM_TABLE';
  parentObjectName?: string | null;
  businessDomain: string;
  ownerService: string;
  lifecycleState: 'ACTIVE' | 'PLANNED' | 'DEPRECATED' | 'RETIRED';
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  reviewState: 'DISCOVERED' | 'REVIEW_REQUIRED' | 'VERIFIED';
  description?: string | null;
  reviewNote?: string | null;
  estimatedRows: number;
  totalBytes: number;
  tenantScoped: boolean;
  constraintCount: number;
  indexCount: number;
  inboundRelationships: number;
  outboundRelationships: number;
  primaryKey: string[];
  columns: ProviderDataColumn[];
};

export type ProviderDataRelationship = {
  relationshipId: string;
  databaseKey: string;
  constraintName: string;
  sourceAssetKey: string;
  targetAssetKey: string;
  sourceColumns: string[];
  targetColumns: string[];
  sourceIndexed: boolean;
};

export type ProviderDataLineageEdge = {
  edgeId: string;
  edgeKey: string;
  sourceAssetKey: string;
  targetAssetKey: string;
  processKey: string;
  edgeType: 'PROVISIONING' | 'EVENT' | 'REPLICATION' | 'REFERENCE' | 'AGGREGATION';
  ownerService: string;
  description: string;
  evidence?: string | null;
  metadata: string;
};

export type ProviderDataGovernanceFinding = {
  findingId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  databaseKey: string;
  assetKey?: string | null;
  title: string;
  detail: string;
  recommendation: string;
  evidence?: string | null;
};

export type ProviderDataGovernanceSnapshot = {
  generatedAt: string;
  summary: ProviderDataGovernanceSummary;
  databases: ProviderDatabaseAssetSummary[];
  assets: ProviderDataAsset[];
  relationships: ProviderDataRelationship[];
  lineage: ProviderDataLineageEdge[];
  findings: ProviderDataGovernanceFinding[];
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
  email: string;
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
  entitlementKeys: string[];
  justification: string;
};

const BASE = '/api/provider/v1/admin';

export async function getProviderOperatorProfile(): Promise<ProviderOperatorProfile> {
  const response = await axiosInstance.get<ApiResponse<ProviderOperatorProfile>>(`${BASE}/me`, {
    timeoutMs: 5_000,
  });
  return response.data.data;
}

export async function getProviderEstateOverview(): Promise<ProviderEstateOverview> {
  const response = await axiosInstance.get<ApiResponse<ProviderEstateOverview>>(`${BASE}/overview`);
  return response.data.data;
}

export async function getProviderCommandCenter(): Promise<ProviderCommandCenter> {
  const response = await axiosInstance.get<ApiResponse<ProviderCommandCenter>>(
    `${BASE}/command-center`
  );
  return response.data.data;
}

export async function getProviderServiceHealth(): Promise<ProviderServiceHealthOverview> {
  const response = await axiosInstance.get<ApiResponse<ProviderServiceHealthOverview>>(
    `${BASE}/service-health`
  );
  return response.data.data;
}

export async function getProviderReliabilityControl(): Promise<ProviderReliabilityControl> {
  const response = await axiosInstance.get<ApiResponse<ProviderReliabilityControl>>(
    `${BASE}/reliability-control`
  );
  return response.data.data;
}

export async function getProviderCommercialOverview(): Promise<ProviderCommercialOverview> {
  const response = await axiosInstance.get<ApiResponse<ProviderCommercialOverview>>(
    `${BASE}/commercial`
  );
  return response.data.data;
}

export async function getProviderAuditInsights(): Promise<ProviderAuditInsights> {
  const response = await axiosInstance.get<ApiResponse<ProviderAuditInsights>>(
    `${BASE}/audit-insights`
  );
  return response.data.data;
}

export async function listProviderRegions(): Promise<ProviderRegion[]> {
  const response = await axiosInstance.get<ApiResponse<ProviderRegion[]>>(`${BASE}/regions`);
  return response.data.data;
}

export async function listProviderTenants(
  params: {
    query?: string;
    state?: string;
    region?: string;
    serviceTier?: string;
    isolationModel?: string;
    page?: number;
    size?: number;
  } = {}
): Promise<PageResult<ProviderTenant>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 50),
  });
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.state) search.set('state', params.state);
  if (params.region) search.set('region', params.region);
  if (params.serviceTier) search.set('serviceTier', params.serviceTier);
  if (params.isolationModel) search.set('isolationModel', params.isolationModel);
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

export async function listProviderOperationApprovals(
  state?: string
): Promise<ProviderOperationApproval[]> {
  const search = state ? `?state=${encodeURIComponent(state)}` : '';
  const response = await axiosInstance.get<ApiResponse<ProviderOperationApproval[]>>(
    `${BASE}/operation-approvals${search}`
  );
  return response.data.data;
}

export async function decideProviderOperationApproval(
  approval: ProviderOperationApproval,
  decision: 'APPROVED' | 'REJECTED',
  reason: string
): Promise<ProviderOperationApproval> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderOperationApproval>,
    { decision: string; reason: string; version: number }
  >(`${BASE}/operation-approvals/${approval.operationApprovalId}/decision`, {
    decision,
    reason,
    version: approval.version,
  });
  return response.data.data;
}

export async function createProviderIncident(request: {
  title: string;
  severity: ProviderServiceIncident['severity'];
  impactScope: string;
  serviceKey?: string | null;
  regionKey?: string | null;
  deploymentCellId?: string | null;
  tenantId?: string | null;
  customerImpact: string;
  publicSummary?: string | null;
  initialUpdate: string;
}): Promise<ProviderServiceIncident> {
  const response = await axiosInstance.post<ApiResponse<ProviderServiceIncident>, typeof request>(
    `${BASE}/incidents`,
    request
  );
  return response.data.data;
}

export async function updateProviderIncident(
  incident: ProviderServiceIncident,
  state: 'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED',
  message: string,
  visibility: 'INTERNAL' | 'CUSTOMER' = 'INTERNAL'
): Promise<ProviderServiceIncident> {
  const response = await axiosInstance.patch<
    ApiResponse<ProviderServiceIncident>,
    { state: string; message: string; visibility: string; version: number }
  >(`${BASE}/incidents/${incident.incidentId}`, {
    state,
    message,
    visibility,
    version: incident.version,
  });
  return response.data.data;
}

export async function createProviderMaintenanceWindow(request: {
  trackingKey: string;
  title: string;
  summary: string;
  scopeType: 'GLOBAL' | 'SERVICE' | 'REGION' | 'CELL' | 'TENANT';
  serviceKey?: string | null;
  regionKey?: string | null;
  deploymentCellId?: string | null;
  tenantId?: string | null;
  impactType:
    | 'NO_IMPACT'
    | 'BRIEF_INTERRUPTION'
    | 'DEGRADED_PERFORMANCE'
    | 'SERVICE_UNAVAILABLE'
    | 'FAILOVER'
    | 'OTHER';
  expectedImpactSeconds: number;
  startsAt: string;
  endsAt: string;
  customerNoticeAt: string;
  minimumNoticeHours: number;
}): Promise<ProviderMaintenanceWindow> {
  const response = await axiosInstance.post<ApiResponse<ProviderMaintenanceWindow>, typeof request>(
    `${BASE}/maintenance-windows`,
    request
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
  const response = await axiosInstance.post<ApiResponse<ProviderDomainChallenge>, typeof request>(
    `${BASE}/tenants/${tenantId}/domains`,
    request
  );
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

export async function listProviderSupportScopes(): Promise<ProviderSupportScope[]> {
  const response = await axiosInstance.get<ApiResponse<ProviderSupportScope[]>>(
    `${BASE}/support-scopes`
  );
  return response.data.data;
}

export async function createProviderSupportSession(request: {
  tenantId: string;
  scopes: string[];
  durationMinutes: number;
  justification: string;
  approvalReference?: string | null;
  emergencyAccess: boolean;
}): Promise<ProviderSupportSession> {
  const response = await axiosInstance.post<ApiResponse<ProviderSupportSession>, typeof request>(
    `${BASE}/support-sessions`,
    request
  );
  return response.data.data;
}

export async function getProviderSupportSessionContext(): Promise<ProviderSupportSessionContext | null> {
  const response = await axiosInstance.get<ApiResponse<ProviderSupportSessionContext | null>>(
    `${BASE}/support-session-context`
  );
  return response.data.data ?? null;
}

export async function revokeProviderSupportSession(
  session: Pick<ProviderSupportSession, 'supportSessionId' | 'version'>,
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

export async function getProviderDataGovernance(): Promise<ProviderDataGovernanceSnapshot> {
  const response = await axiosInstance.get<ApiResponse<ProviderDataGovernanceSnapshot>>(
    `${BASE}/data-governance`
  );
  return response.data.data;
}

export async function refreshProviderDataGovernance(): Promise<ProviderDataGovernanceSnapshot> {
  const response = await axiosInstance.post<ApiResponse<ProviderDataGovernanceSnapshot>, undefined>(
    `${BASE}/data-governance/refresh`,
    undefined
  );
  return response.data.data;
}
