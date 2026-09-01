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

export type ProviderFeatureValue = boolean | string | number | Record<string, unknown> | unknown[];

export type ProviderFeatureFlag = {
  featureFlagId: string;
  featureKey: string;
  displayName: string;
  description: string;
  ownerService: string;
  valueType: 'BOOLEAN' | 'STRING' | 'NUMBER' | 'JSON';
  defaultValue: ProviderFeatureValue;
  configurationSchema: Record<string, unknown>;
  riskTier: 'L1' | 'L2' | 'L3';
  lifecycleState: 'ACTIVE' | 'DEPRECATED' | 'RETIRED';
  version: number;
};

export type ProviderFeatureRolloutStage = {
  rolloutStageId: string;
  stageOrder: number;
  stageName: string;
  exposurePercentage: number;
  minimumObservationMinutes: number;
  healthGate: Record<string, unknown>;
  lifecycleState: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED';
  startedAt?: string | null;
  completedAt?: string | null;
};

export type ProviderFeatureRolloutApproval = {
  approvalId: string;
  lifecycleState: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedBy: number;
  requestedAt: string;
  decidedBy?: number | null;
  decidedAt?: string | null;
  decisionReason?: string | null;
};

export type ProviderFeatureRollout = {
  rolloutRevisionId: string;
  featureFlagId: string;
  featureKey: string;
  revisionNumber: number;
  name: string;
  lifecycleState:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'ACTIVE'
    | 'PAUSED'
    | 'COMPLETED'
    | 'REJECTED'
    | 'ROLLED_BACK'
    | 'CANCELLED';
  rolloutValue: ProviderFeatureValue;
  targeting: Record<string, unknown>;
  strategy: 'RING' | 'PERCENTAGE' | 'ALL_AT_ONCE';
  currentStageOrder?: number | null;
  previousRevisionId?: string | null;
  rollbackOfRevisionId?: string | null;
  justification: string;
  requestedBy: number;
  approvedBy?: number | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  activatedAt?: string | null;
  completedAt?: string | null;
  pausedAt?: string | null;
  version: number;
  stages: ProviderFeatureRolloutStage[];
  approval?: ProviderFeatureRolloutApproval | null;
  externalExecutionEnabled: boolean;
};

export type ProviderFeatureEvaluation = {
  featureKey: string;
  providerTenantId: string;
  tenantKey: string;
  value: ProviderFeatureValue;
  reasonCode: 'DEFAULT' | 'TARGET_MISS' | 'PERCENTAGE_EXCLUDED' | 'ROLLOUT_MATCH';
  rolloutRevisionId?: string | null;
  revisionNumber?: number | null;
  exposurePercentage: number;
  deterministicBucket: number;
  externalExecutionEnabled: boolean;
  evaluatedAt: string;
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

export type ProviderTenantAdministratorPosture = {
  configuredCount: number;
  activeCount: number;
  pendingDeliveryCount: number;
  primaryConfigured: boolean;
  lastInvitedAt?: string | null;
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
  administratorPosture: ProviderTenantAdministratorPosture;
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
  version: number;
};

export type ProviderSubscriptionRenewalRevision = {
  renewalRevisionId: string;
  subscriptionId: string;
  organizationId: string;
  organizationKey: string;
  organizationName: string;
  revisionNumber: number;
  lifecycleState: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'PUBLISHED';
  baselineSubscriptionVersion: number;
  currentPlanKey: string;
  currentPlanName: string;
  targetPlanKey: string;
  targetPlanName: string;
  targetServiceTier: string;
  currentEndsAt?: string | null;
  proposedEndsAt: string;
  currentContractReference?: string | null;
  proposedContractReference: string;
  reason: string;
  addedEntitlements: string[];
  removedEntitlements: string[];
  impactedTenants: number;
  currentEntitlementCount: number;
  projectedEntitlementCount: number;
  contentSha256: string;
  requestKey: string;
  requestedBy: number;
  requestedByName: string;
  requestedAt: string;
  decisionDueAt: string;
  decidedBy?: number | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionReason?: string | null;
  publishedBy?: number | null;
  publishedByName?: string | null;
  publishedAt?: string | null;
  executionState: 'NOT_STARTED' | 'NOT_REQUIRED' | 'MANUAL_ACTION_REQUIRED' | 'COMPLETED';
  notificationState: 'DISABLED_PENDING_CONTRACT' | 'NOT_REQUIRED' | 'QUEUED' | 'SENT' | 'FAILED';
  version: number;
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
  supportAccessRequestId?: string | null;
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  operatorOwned: boolean;
  operatorName: string;
  lifecycleState: string;
  scopes: string[];
  accessMode: 'STANDARD' | 'BREAK_GLASS';
  riskTier: 'L1' | 'L2' | 'L3';
  startedAt: string;
  expiresAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  version: number;
};

export type ProviderSupportAccessRequest = {
  supportAccessRequestId: string;
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  requesterOwned: boolean;
  requesterName: string;
  lifecycleState:
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'DENIED'
    | 'CANCELLED'
    | 'EXPIRED'
    | 'ACTIVATED'
    | 'COMPLETED'
    | 'REVIEWED';
  accessMode: 'STANDARD' | 'BREAK_GLASS';
  justification: string;
  scopes: string[];
  durationMinutes: number;
  approvalReference?: string | null;
  customerApprovalRequired: boolean;
  riskTier: 'L1' | 'L2' | 'L3';
  requestedAt: string;
  decisionDueAt: string;
  supportSessionId?: string | null;
  activatedAt?: string | null;
  completedAt?: string | null;
  postReviewState: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
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
  tenantKey: string;
  environmentKey?: string | null;
  dataRegion?: string | null;
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

export type ProviderSupportPostReviewEvidenceEvent = {
  auditEventId: string;
  occurredAt: string;
  decision: 'ALLOW' | 'DENY';
  method: string;
  routeTemplate: string;
  scope?: string | null;
  outcome: 'SUCCESS' | 'DENIED';
  reasonCode?: string | null;
  correlationId: string;
};

export type ProviderSupportPostReviewEvidence = {
  supportAccessRequestId: string;
  supportSessionId: string;
  tenantId: string;
  sessionLifecycleState: string;
  evidenceFrom: string;
  evidenceThrough: string;
  grantedScopes: string[];
  observedScopes: string[];
  totalEventCount: number;
  actualUseCount: number;
  deniedAttemptCount: number;
  evidenceComplete: boolean;
  displayTruncated: boolean;
  noUseConfirmed: boolean;
  readiness: 'INCOMPLETE' | 'READY_WITH_USE' | 'READY_NO_USE';
  anomalies: string[];
  events: ProviderSupportPostReviewEvidenceEvent[];
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

export type ProviderDataPolicyImpact = {
  catalogGeneratedAt: string;
  affectedAssetCount: number;
  affectedAssetKeys: string[];
  blockers: string[];
  warnings: string[];
  controls: string[];
  impactHash: string;
  previewedAt: string;
  publishable: boolean;
};

export type ProviderDataPolicyApproval = {
  approvalId: string;
  lifecycleState: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedBy: number;
  requestedAt: string;
  decidedBy?: number | null;
  decidedAt?: string | null;
  decisionReason?: string | null;
};

export type ProviderDataPolicyRevision = {
  revisionId: string;
  revisionNumber: number;
  lifecycleState:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'ACTIVE'
    | 'REJECTED'
    | 'SUPERSEDED'
    | 'ROLLED_BACK'
    | 'CANCELLED';
  policyRule: Record<string, unknown>;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  justification: string;
  previousRevisionId?: string | null;
  rollbackOfRevisionId?: string | null;
  impact?: ProviderDataPolicyImpact | null;
  requestedBy: number;
  approvedBy?: number | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  version: number;
  approval?: ProviderDataPolicyApproval | null;
};

export type ProviderDataPolicy = {
  policyId: string;
  policyKey: string;
  displayName: string;
  description: string;
  policyType:
    | 'CLASSIFICATION'
    | 'MINIMIZATION'
    | 'RESIDENCY'
    | 'RETENTION'
    | 'DELETION'
    | 'LEGAL_HOLD'
    | 'RESTRICTED_FIELD'
    | 'TENANT_RLS';
  scopeType: 'GLOBAL' | 'DATABASE' | 'ASSET';
  scopeRef?: string | null;
  ownerService: string;
  lifecycleState: 'ACTIVE' | 'RETIRED';
  version: number;
  revisions: ProviderDataPolicyRevision[];
};

export type ProviderDomainChallenge = {
  domain: ProviderTenantDomain;
  recordName: string;
  recordType: string;
  recordValue: string;
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
