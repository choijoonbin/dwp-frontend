import { axiosInstance } from '../axios-instance';
import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from './product-surface-governed-mutation';
import { productSurfaceReadScopeConfig } from './product-surface-read-scope';

import type { ApiResponse } from '../types';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

export type PeopleDataAccess = {
  classification: string;
  workerNumberMasked: boolean;
  excludedFieldGroups: string[];
};

export type PersonSummary = {
  personId: string;
  displayName: string;
  preferredLocale?: string | null;
  timeZone?: string | null;
  lifecycleState: string;
  workerNumber?: string | null;
  workerType?: string | null;
  workerStatus?: string | null;
  assignmentKey?: string | null;
  businessTitle?: string | null;
  organizationId?: string | null;
  organizationKey?: string | null;
  organizationName?: string | null;
  jobProfileName?: string | null;
  managementLevel?: string | null;
  jobGradeKey?: string | null;
  jobGradeName?: string | null;
  locationKey?: string | null;
  locationName?: string | null;
  workEmail?: string | null;
  profileImageKey?: string | null;
  assignmentEffectiveFrom?: string | null;
  managerPersonId?: string | null;
  managerDisplayName?: string | null;
  directReportCount: number;
  dataAccess: PeopleDataAccess;
};

export type PersonAssignment = {
  assignmentKey?: string | null;
  assignmentStatus: string;
  primaryAssignment: boolean;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  businessTitle?: string | null;
  organizationName?: string | null;
  jobProfileName?: string | null;
  jobGradeName?: string | null;
  locationName?: string | null;
  managerAssignmentKey?: string | null;
  changeReasonCode?: string | null;
};

export type WorkAssignment = {
  assignmentId: string;
  assignmentKey?: string | null;
  assignmentStatus: string;
  primaryAssignment: boolean;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  effectiveSequence: number;
  businessTitle?: string | null;
  organizationId?: string | null;
  organizationKey?: string | null;
  organizationName?: string | null;
  jobProfileName?: string | null;
  jobGradeName?: string | null;
  locationKey?: string | null;
  locationName?: string | null;
  managerAssignmentKey?: string | null;
  changeReasonCode?: string | null;
};

export type WorkRelationship = {
  workRelationshipId: string;
  relationshipKey?: string | null;
  relationshipType: string;
  primaryRelationship: boolean;
  startDate: string;
  endDate?: string | null;
  projectedEndDate?: string | null;
  legalEmployerKey: string;
  legalEmployerName: string;
  legalEmployerCountryCode?: string | null;
  assignments: WorkAssignment[];
};

export type PersonWorker = {
  workerId: string;
  workerNumber?: string | null;
  workerType: string;
  workerStatus: string;
  originalHireDate?: string | null;
  workRelationships: WorkRelationship[];
};

export type PersonDetail = {
  person: PersonSummary;
  originalHireDate?: string | null;
  legalEmployerName?: string | null;
  managerAssignmentKey?: string | null;
  assignments: PersonAssignment[];
  workers: PersonWorker[];
};

export type PeopleCursorPage = {
  items: PersonSummary[];
  nextCursor?: string | null;
  size: number;
  hasMore: boolean;
  asOf: string;
};

export type WorkforceOrganizationCandidate = {
  publicId: string;
  displayName: string;
  organization: string;
  position?: string | null;
  eligibility: 'ELIGIBLE' | 'INELIGIBLE';
};

export type OrganizationChartMetrics = {
  headcount: number;
  activeHeadcount: number;
  onLeaveHeadcount: number;
  contingentHeadcount: number;
  organizationCount: number;
  managerCount: number;
  openPositionCount: number;
  locationCount: number;
  plannedFte: number;
  workforceCostAmount: number;
  costCurrency?: string | null;
};

export type OrganizationChartOrganization = {
  organizationId: string;
  organizationKey: string;
  name: string;
  shortName?: string | null;
  organizationType: string;
  organizationTypeName: string;
  parentOrganizationId?: string | null;
  description?: string | null;
  costCenterKey?: string | null;
  colorToken?: string | null;
  directHeadcount: number;
  totalHeadcount: number;
  managerCount: number;
  openPositionCount: number;
  childOrganizationCount: number;
  leaderPersonId?: string | null;
  directMemberIds: string[];
  layerDepth: number;
  averageManagerSpan: number;
  contingentHeadcount: number;
  healthStatus: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
  healthSignals: string[];
};

export type OrganizationChartPerson = {
  personId: string;
  assignmentKey: string;
  displayName: string;
  workEmail?: string | null;
  businessTitle?: string | null;
  jobProfileName?: string | null;
  jobGradeKey?: string | null;
  jobGradeName?: string | null;
  jobGradeOrder: number;
  managementLevel?: string | null;
  organizationId: string;
  managerPersonId?: string | null;
  managerReferenceMissing: boolean;
  positionId?: string | null;
  positionKey?: string | null;
  workerNumber?: string | null;
  workerType: string;
  workerStatus: string;
  locationKey?: string | null;
  locationName?: string | null;
  directReportCount: number;
  fullTimeEquivalent: number;
};

export type OrganizationChartPosition = {
  positionId: string;
  positionKey: string;
  title: string;
  organizationId: string;
  reportsToPositionId?: string | null;
  status: 'FILLED' | 'OPEN' | 'PLANNED' | string;
  positionType: string;
  criticality: 'STANDARD' | 'HIGH' | 'CRITICAL' | string;
  budgetedFte: number;
  annualCostAmount?: number | null;
  costCurrency?: string | null;
  jobProfileName?: string | null;
  locationName?: string | null;
  availabilityDate?: string | null;
  incumbentPersonIds: string[];
  subordinatePositionCount: number;
};

export type OrganizationChartRelationship = {
  childOrganizationId: string;
  parentOrganizationId: string;
  relationshipType: 'SUPERVISORY' | 'MATRIX' | 'FUNCTIONAL';
  primaryRelationship: boolean;
};

export type OrganizationChartOpenPosition = {
  positionId: string;
  positionKey: string;
  title: string;
  organizationId: string;
  jobProfileName?: string | null;
  locationName?: string | null;
  availabilityDate?: string | null;
  budgetedFte: number;
  annualCostAmount?: number | null;
  costCurrency?: string | null;
  criticality: string;
};

export type OrganizationChartScenarioProjection = {
  scenarioId: string;
  name: string;
  lifecycleState: string;
  baseAsOf: string;
  effectiveDate: string;
  activeChangeCount: number;
  version: number;
};

export type OrganizationDesignPolicy = {
  minimumManagerSpan: number;
  maximumManagerSpan: number;
  maximumLayers: number;
  maximumContingentPercent: number;
  maximumVacancyPercent: number;
};

export type OrganizationAnalysis = {
  healthScore: number;
  dataQualityScore: number;
  averageManagerSpan: number;
  maximumLayers: number;
  managerRatioPercent: number;
  contingentRatioPercent: number;
  narrowSpanManagerCount: number;
  wideSpanManagerCount: number;
  singleReportManagerCount: number;
  missingManagerCount: number;
  missingGradeCount: number;
  orphanOrganizationCount: number;
  policy: OrganizationDesignPolicy;
  signals: Array<{
    code: string;
    severity: string;
    count: number;
    organizationId?: string | null;
  }>;
};

export type OrganizationChart = {
  asOf: string;
  company: {
    organizationId: string;
    organizationKey: string;
    name: string;
    description?: string | null;
  };
  scenario?: OrganizationChartScenarioProjection | null;
  metrics: OrganizationChartMetrics;
  analysis: OrganizationAnalysis;
  organizations: OrganizationChartOrganization[];
  people: OrganizationChartPerson[];
  positions: OrganizationChartPosition[];
  relationships: OrganizationChartRelationship[];
  openPositions: OrganizationChartOpenPosition[];
};

export type OrganizationHealthInsight = {
  organizationId: string;
  organizationName: string;
  organizationType: string;
  layer: number;
  directHeadcount: number;
  totalHeadcount: number;
  managerCount: number;
  averageManagerSpan: number;
  overloadedManagerCount: number;
  openPositionCount: number;
  contingentRatioPct: number;
  healthScore: number;
  riskState: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
  signals: string[];
};

export type OrganizationChangeInsight = {
  changeType: string;
  entityType: string;
  entityId: string;
  entityName: string;
  fromValue?: string | null;
  toValue?: string | null;
  riskState: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
};

export type OrganizationDataQualityIssue = {
  issueCode: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entityType: string;
  entityId: string;
  entityName: string;
  message: string;
};

export type OrganizationIntelligence = {
  asOf: string;
  compareTo: string;
  health: {
    maximumLayers: number;
    averageManagerSpan: number;
    medianManagerSpan: number;
    overloadedManagers: number;
    singleReportManagers: number;
    managerReferenceIssues: number;
    disconnectedOrganizations: number;
    openPositions: number;
    contingentRatioPct: number;
    organizationHealthScore: number;
    dataQualityScore: number;
    organizationsAtRisk: number;
    criticalOrganizations: number;
    attentionOrganizations: number;
  };
  comparison: {
    headcountDelta: number;
    organizationDelta: number;
    managerDelta: number;
    openPositionDelta: number;
    peopleMoved: number;
    managerChanges: number;
    organizationMoves: number;
    totalChanges: number;
    plannedFteDelta: number;
    workforceCostDelta: number;
    costCurrency?: string | null;
    averageManagerSpanDelta: number;
    maximumLayersDelta: number;
    organizationHealthScoreDelta: number;
    dataQualityScoreDelta: number;
  };
  organizations: OrganizationHealthInsight[];
  changes: OrganizationChangeInsight[];
  dataQualityIssues: OrganizationDataQualityIssue[];
};

export type OrganizationScenarioChange = {
  changeId: string;
  sequence: number;
  changeType: string;
  payloadSchemaVersion: number;
  targetKind: string;
  targetReference: string;
  relatedReference?: string | null;
  effectiveDate: string;
  beforeSnapshot: string;
  afterSnapshot: string;
  estimatedHeadcountDelta: number;
  estimatedFteDelta: number;
  estimatedCostDelta?: number | null;
  costCurrency?: string | null;
  validationState: string;
  validationMessage?: string | null;
  version: number;
};

export type OrganizationScenarioApproval = {
  approvalId: string;
  gateKey: string;
  requiredRoleCode: string;
  separationOfDuties: boolean;
  lifecycleState: string;
  requestedBy: number;
  decidedBy?: number | null;
  requestReason: string;
  decisionReason?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  expiresAt: string;
  requestValidationRunId?: string | null;
  decisionValidationRunId?: string | null;
  evidenceBindingState: 'BOUND' | 'LEGACY_UNBOUND';
  version: number;
};

export type OrganizationScenario = {
  scenarioId: string;
  scenarioKey: string;
  name: string;
  description?: string | null;
  sourceScenarioId?: string | null;
  baselineDate: string;
  effectiveDate: string;
  lifecycleState: string;
  ownerUserId: number;
  submittedAt?: string | null;
  publishedAt?: string | null;
  publicationValidationRunId?: string | null;
  publicationEvidenceState: 'BOUND' | 'LEGACY_UNBOUND';
  version: number;
  changes: OrganizationScenarioChange[];
  approval?: OrganizationScenarioApproval | null;
};

export type OrganizationScenarioDecisionMetrics = {
  headcount: number;
  organizationCount: number;
  managerCount: number;
  openPositionCount: number;
  plannedFte: number;
  workforceCost: number;
  costCurrency?: string | null;
  averageManagerSpan: number;
  maximumLayers: number;
  organizationHealthScore: number;
  dataQualityScore: number;
};

export type OrganizationScenarioDecisionCheck = {
  checkCode: string;
  outcome: 'PASS' | 'WARN' | 'BLOCK';
  severity: 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entityType: string;
  entityReference?: string | null;
  evidence: Record<string, string | number | boolean>;
};

export type OrganizationScenarioDecisionPack = {
  scenarioId: string;
  scenarioVersion: number;
  lifecycleState: string;
  baselineDate: string;
  effectiveDate: string;
  decisionState: 'READY' | 'REVIEW_REQUIRED' | 'BLOCKED';
  readinessScore: number;
  baselineCurrent: boolean;
  baselineFingerprint: string;
  observedFingerprint: string;
  blockingIssueCount: number;
  warningCount: number;
  baseline: OrganizationScenarioDecisionMetrics;
  proposed: OrganizationScenarioDecisionMetrics;
  delta: OrganizationScenarioDecisionMetrics;
  checks: OrganizationScenarioDecisionCheck[];
  validationRunId?: string | null;
  evaluatedAt: string;
};

export type OrganizationScenarioValidationRun = {
  validationRunId: string;
  scenarioVersion: number;
  triggerType: 'MANUAL' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH';
  decisionState: 'READY' | 'REVIEW_REQUIRED' | 'BLOCKED';
  readinessScore: number;
  baselineCurrent: boolean;
  blockingIssueCount: number;
  warningCount: number;
  evaluatedAt: string;
  evaluatedBy: number;
  correlationId?: string | null;
};

export type HrisSourceSystem = {
  sourceSystemId: number;
  sourceKey: string;
  systemType: string;
  name: string;
  lifecycleState: string;
  version: number;
};

export type HrisConnector = {
  connectorInstanceId: string;
  sourceSystemId: number;
  sourceKey: string;
  connectorKey: string;
  connectorType: string;
  endpointUri?: string | null;
  authMode?: string | null;
  credentialReference?: string | null;
  scheduleExpression?: string | null;
  lifecycleState: string;
  healthState: string;
  lastHealthCheckedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastAttemptedSyncAt?: string | null;
  lastErrorCode?: string | null;
  consecutiveFailureCount: number;
  version: number;
};

export type CreateHrisConnectorRequest = {
  sourceKey: string;
  sourceType: 'WORKDAY' | 'ORACLE_HCM' | 'SAP_HCM' | 'SCIM' | 'CUSTOM';
  sourceName: string;
  connectorKey: string;
  connectorType:
    | 'WORKDAY_REST'
    | 'WORKDAY_SOAP'
    | 'ORACLE_HCM_REST'
    | 'SAP_SUCCESSFACTORS'
    | 'SCIM_BRIDGE'
    | 'CUSTOM_REST'
    | 'FILE_IMPORT';
  endpointUri?: string;
  authMode: 'NONE' | 'BASIC' | 'OAUTH2_CLIENT_CREDENTIALS' | 'MTLS' | 'SIGNED_REQUEST';
  credentialReference?: string;
  scheduleExpression?: string;
};

export type HrisConfigurationCheck = {
  connectorInstanceId: string;
  valid: boolean;
  healthState: string;
  externalConnectivityTested: boolean;
  issues: string[];
  checkedAt: string;
};

export type HrisMappingProfile = {
  mappingProfileId: string;
  sourceSystemId: number;
  profileKey: string;
  adapterType: string;
  sourceSchemaVersion: string;
  targetSchemaVersion: string;
  lifecycleState: string;
  mappingSha256: string;
  activatedAt?: string | null;
  version: number;
};

export type HrisSyncRun = {
  syncRunId: string;
  sourceKey: string;
  syncMode: string;
  lifecycleState: string;
  requestedWatermark?: string | null;
  committedWatermark?: string | null;
  readCount: number;
  createdCount: number;
  updatedCount: number;
  rejectedCount: number;
  connectorInstanceId?: string | null;
  mappingProfileId?: string | null;
  retryOfSyncRunId?: string | null;
  pageCount: number;
  unchangedCount: number;
  failureCode?: string | null;
  redactedFailureMessage?: string | null;
  version: number;
  startedAt: string;
  completedAt?: string | null;
};

export type HrisReconciliationRun = {
  reconciliationRunId: string;
  connectorInstanceId: string;
  syncRunId?: string | null;
  lifecycleState: string;
  checkedCount: number;
  issueCount: number;
  criticalCount: number;
  startedAt: string;
  completedAt?: string | null;
};

export type HrisReconciliationIssue = {
  reconciliationIssueId: string;
  reconciliationRunId: string;
  connectorInstanceId: string;
  issueCode: string;
  severity: string;
  entityType: string;
  internalKey?: string | null;
  externalId?: string | null;
  redactedSummary: string;
  lifecycleState: string;
  firstDetectedAt: string;
  resolvedAt?: string | null;
};

export type HrisImportResult = {
  syncRunId: string;
  sourceKey: string;
  lifecycleState: string;
  readCount: number;
  createdCount: number;
  updatedCount: number;
  rejectedCount: number;
  replayed: boolean;
  syntheticFixture: boolean;
  emittedEventTypes: string[];
};

export async function listPeople(
  params: {
    query?: string;
    status?: string;
    cursor?: string;
    size?: number;
    asOf?: string;
    surface?: 'directory' | 'workforce';
    view?: 'assignments';
    contextScopeKey?: string;
    signal?: AbortSignal;
  } = {}
): Promise<PeopleCursorPage> {
  const search = new URLSearchParams({ size: String(params.size ?? 50) });
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.status) search.set('status', params.status);
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.asOf) search.set('asOf', params.asOf);
  if (params.view) search.set('view', params.view);
  const response = await axiosInstance.get<ApiResponse<PeopleCursorPage>>(
    `/api/people/v1/${params.surface === 'workforce' ? 'workforce/people' : 'people'}?${search.toString()}`,
    productSurfaceReadScopeConfig(params.contextScopeKey, params.signal)
  );
  return response.data.data;
}
export async function getPerson(
  personId: string,
  asOf?: string,
  surface: 'directory' | 'workforce' = 'directory',
  contextScopeKey?: string,
  signal?: AbortSignal,
  view?: 'directory'
): Promise<PersonDetail> {
  const params = new URLSearchParams();
  if (asOf) params.set('asOf', asOf);
  if (view) params.set('view', view);
  const search = params.size ? `?${params.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<PersonDetail>>(
    `/api/people/v1/${surface === 'workforce' ? 'workforce/people' : 'people'}/${encodeURIComponent(personId)}${search}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getOrganizationChart(
  params: {
    asOf?: string;
    rootOrganizationId?: string;
    scenarioId?: string;
    depth?: number;
    surface?: 'directory' | 'workforce';
    view?: 'design' | 'directory';
    contextScopeKey?: string;
    signal?: AbortSignal;
  } = {}
): Promise<OrganizationChart> {
  const search = new URLSearchParams({ depth: String(params.depth ?? 10) });
  if (params.asOf) search.set('asOf', params.asOf);
  if (params.rootOrganizationId) {
    search.set('rootOrganizationId', params.rootOrganizationId);
  }
  if (params.scenarioId) search.set('scenarioId', params.scenarioId);
  if (params.view) search.set('view', params.view);
  const response = await axiosInstance.get<ApiResponse<OrganizationChart>>(
    `/api/people/v1/${params.surface === 'workforce' ? 'workforce/organization/chart' : 'org-chart'}?${search.toString()}`,
    productSurfaceReadScopeConfig(params.contextScopeKey, params.signal)
  );
  return response.data.data;
}

export async function getOrganizationIntelligence(
  params: {
    asOf?: string;
    compareTo?: string;
    rootOrganizationId?: string;
    scenarioId?: string;
    depth?: number;
    contextScopeKey?: string;
    signal?: AbortSignal;
  } = {}
): Promise<OrganizationIntelligence> {
  const search = new URLSearchParams({ depth: String(params.depth ?? 10) });
  if (params.asOf) search.set('asOf', params.asOf);
  if (params.compareTo) search.set('compareTo', params.compareTo);
  if (params.rootOrganizationId) search.set('rootOrganizationId', params.rootOrganizationId);
  if (params.scenarioId) search.set('scenarioId', params.scenarioId);
  const response = await axiosInstance.get<ApiResponse<OrganizationIntelligence>>(
    `/api/people/v1/workforce/organization/intelligence?${search.toString()}`,
    productSurfaceReadScopeConfig(params.contextScopeKey, params.signal)
  );
  return response.data.data;
}

const ORG_SCENARIO_BASE = '/api/people/v1/workforce/organization/scenarios';

export const HCM_ORGANIZATION_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createOrganizationScenario',
    routeContractKey: 'route.hcm.management.org-create.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}`,
  },
  {
    apiFunction: 'cloneOrganizationScenario',
    routeContractKey: 'route.hcm.management.org-clone.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/clone`,
  },
  {
    apiFunction: 'addOrganizationScenarioMove',
    routeContractKey: 'route.hcm.management.org-update.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/moves`,
  },
  {
    apiFunction: 'addOrganizationScenarioPositionMove',
    routeContractKey: 'route.hcm.management.org-update.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/position-moves`,
  },
  {
    apiFunction: 'createOrganizationScenarioPosition',
    routeContractKey: 'route.hcm.management.org-update.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/positions`,
  },
  {
    apiFunction: 'closeOrganizationScenarioPosition',
    routeContractKey: 'route.hcm.management.org-update.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/positions/{positionId}/close`,
  },
  {
    apiFunction: 'validateOrganizationScenarioDecisionPack',
    routeContractKey: 'route.hcm.management.org-update.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/decision-pack/validate`,
  },
  {
    apiFunction: 'removeOrganizationScenarioChange',
    routeContractKey: 'route.hcm.management.org-update.action',
    method: 'DELETE',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/changes/{changeId}`,
  },
  {
    apiFunction: 'submitOrganizationScenario',
    routeContractKey: 'route.hcm.management.org-update.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/submit`,
  },
  {
    apiFunction: 'cancelOrganizationScenario',
    routeContractKey: 'route.hcm.management.org-update.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/cancel`,
  },
  {
    apiFunction: 'decideOrganizationScenario',
    routeContractKey: 'route.hcm.management.org-approval.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/approval`,
  },
  {
    apiFunction: 'publishOrganizationScenario',
    routeContractKey: 'route.hcm.management.org-publish.action',
    method: 'POST',
    path: `${ORG_SCENARIO_BASE}/{scenarioId}/publish`,
  },
] as const;

export async function listOrganizationScenarios(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<OrganizationScenario[]> {
  const response = await axiosInstance.get<ApiResponse<OrganizationScenario[]>>(
    ORG_SCENARIO_BASE,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function listWorkforceOrganizationCandidates(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<WorkforceOrganizationCandidate[]> {
  const response = await axiosInstance.get<ApiResponse<WorkforceOrganizationCandidate[]>>(
    '/api/people/v1/workforce/organization/candidates',
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function createOrganizationScenario(
  request: {
    scenarioKey: string;
    name: string;
    description?: string;
    baselineDate: string;
    effectiveDate: string;
  },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, typeof request>(
    ORG_SCENARIO_BASE,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function cloneOrganizationScenario(
  sourceScenarioId: string,
  request: {
    scenarioKey: string;
    name: string;
    description?: string;
    effectiveDate: string;
  },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, typeof request>(
    `${ORG_SCENARIO_BASE}/${sourceScenarioId}/clone`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function addOrganizationScenarioMove(
  scenario: OrganizationScenario,
  organizationId: string,
  newParentOrganizationId: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenario>,
    { organizationId: string; newParentOrganizationId: string; version: number }
  >(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/moves`,
    { organizationId, newParentOrganizationId, version: scenario.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function addOrganizationScenarioPositionMove(
  scenario: OrganizationScenario,
  positionId: string,
  newParentPositionId: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenario>,
    { positionId: string; newParentPositionId: string; version: number }
  >(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/position-moves`,
    { positionId, newParentPositionId, version: scenario.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function createOrganizationScenarioPosition(
  scenario: OrganizationScenario,
  request: {
    positionKey: string;
    title: string;
    organizationId: string;
    reportsToPositionId: string;
    positionType: 'REGULAR' | 'SHARED' | 'ASSISTANT' | 'TEMPORARY';
    criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    budgetedFte: number;
    annualCostAmount?: number;
    costCurrency?: string;
    availabilityDate: string;
  },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const payload = { ...request, version: scenario.version };
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, typeof payload>(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/positions`,
    payload,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function closeOrganizationScenarioPosition(
  scenario: OrganizationScenario,
  positionId: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, { version: number }>(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/positions/${positionId}/close`,
    { version: scenario.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function getOrganizationScenarioDecisionPack(
  scenarioId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<OrganizationScenarioDecisionPack> {
  const response = await axiosInstance.get<ApiResponse<OrganizationScenarioDecisionPack>>(
    `${ORG_SCENARIO_BASE}/${scenarioId}/decision-pack`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getOrganizationScenarioDecisionHistory(
  scenarioId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<OrganizationScenarioValidationRun[]> {
  const response = await axiosInstance.get<ApiResponse<OrganizationScenarioValidationRun[]>>(
    `${ORG_SCENARIO_BASE}/${scenarioId}/decision-pack/history`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function validateOrganizationScenarioDecisionPack(
  scenario: OrganizationScenario,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenarioDecisionPack> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenarioDecisionPack>,
    { version: number }
  >(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/decision-pack/validate`,
    { version: scenario.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function removeOrganizationScenarioChange(
  scenario: OrganizationScenario,
  changeId: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const search = new URLSearchParams({ version: String(scenario.version) });
  const response = await axiosInstance.delete<ApiResponse<OrganizationScenario>>(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/changes/${changeId}?${search.toString()}`,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function submitOrganizationScenario(
  scenario: OrganizationScenario,
  reason: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenario>,
    { reason: string; version: number }
  >(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/submit`,
    { reason, version: scenario.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function decideOrganizationScenario(
  scenario: OrganizationScenario,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  if (!scenario.approval) throw new Error('The scenario has no approval gate.');
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenario>,
    { decision: string; reason: string; version: number }
  >(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/approval`,
    { decision, reason, version: scenario.approval.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function cancelOrganizationScenario(
  scenario: OrganizationScenario,
  reason: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenario>,
    { reason: string; version: number }
  >(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/cancel`,
    { reason, version: scenario.version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function publishOrganizationScenario(
  scenarioId: string,
  version: number,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, { version: number }>(
    `${ORG_SCENARIO_BASE}/${scenarioId}/publish`,
    { version },
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  return response.data.data;
}

export * from './hris-admin-api';
