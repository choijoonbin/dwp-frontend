import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

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
  assignmentKey: string;
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

export type PersonDetail = {
  person: PersonSummary;
  originalHireDate?: string | null;
  legalEmployerName?: string | null;
  managerAssignmentKey?: string | null;
  assignments: PersonAssignment[];
};

export type PeopleCursorPage = {
  items: PersonSummary[];
  nextCursor?: string | null;
  size: number;
  hasMore: boolean;
  asOf: string;
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
  profileKey: string;
  adapterType: string;
  sourceSchemaVersion: string;
  targetSchemaVersion: string;
  lifecycleState: string;
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
  startedAt: string;
  completedAt?: string | null;
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
  } = {}
): Promise<PeopleCursorPage> {
  const search = new URLSearchParams({ size: String(params.size ?? 50) });
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.status) search.set('status', params.status);
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.asOf) search.set('asOf', params.asOf);
  const response = await axiosInstance.get<ApiResponse<PeopleCursorPage>>(
    `/api/people/v1/people?${search.toString()}`
  );
  return response.data.data;
}

export async function getPerson(personId: string, asOf?: string): Promise<PersonDetail> {
  const search = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
  const response = await axiosInstance.get<ApiResponse<PersonDetail>>(
    `/api/people/v1/people/${encodeURIComponent(personId)}${search}`
  );
  return response.data.data;
}

export async function getOrganizationChart(
  params: {
    asOf?: string;
    rootOrganizationId?: string;
    scenarioId?: string;
    depth?: number;
  } = {}
): Promise<OrganizationChart> {
  const search = new URLSearchParams({ depth: String(params.depth ?? 10) });
  if (params.asOf) search.set('asOf', params.asOf);
  if (params.rootOrganizationId) {
    search.set('rootOrganizationId', params.rootOrganizationId);
  }
  if (params.scenarioId) search.set('scenarioId', params.scenarioId);
  const response = await axiosInstance.get<ApiResponse<OrganizationChart>>(
    `/api/people/v1/org-chart?${search.toString()}`
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
  } = {}
): Promise<OrganizationIntelligence> {
  const search = new URLSearchParams({ depth: String(params.depth ?? 10) });
  if (params.asOf) search.set('asOf', params.asOf);
  if (params.compareTo) search.set('compareTo', params.compareTo);
  if (params.rootOrganizationId) search.set('rootOrganizationId', params.rootOrganizationId);
  if (params.scenarioId) search.set('scenarioId', params.scenarioId);
  const response = await axiosInstance.get<ApiResponse<OrganizationIntelligence>>(
    `/api/people/v1/org-chart/intelligence?${search.toString()}`
  );
  return response.data.data;
}

const ORG_SCENARIO_BASE = '/api/people/v1/org-chart/scenarios';

export async function listOrganizationScenarios(): Promise<OrganizationScenario[]> {
  const response = await axiosInstance.get<ApiResponse<OrganizationScenario[]>>(ORG_SCENARIO_BASE);
  return response.data.data;
}

export async function createOrganizationScenario(request: {
  scenarioKey: string;
  name: string;
  description?: string;
  baselineDate: string;
  effectiveDate: string;
}): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, typeof request>(
    ORG_SCENARIO_BASE,
    request
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
  }
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, typeof request>(
    `${ORG_SCENARIO_BASE}/${sourceScenarioId}/clone`,
    request
  );
  return response.data.data;
}

export async function addOrganizationScenarioMove(
  scenario: OrganizationScenario,
  organizationId: string,
  newParentOrganizationId: string
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenario>,
    { organizationId: string; newParentOrganizationId: string; version: number }
  >(`${ORG_SCENARIO_BASE}/${scenario.scenarioId}/moves`, {
    organizationId,
    newParentOrganizationId,
    version: scenario.version,
  });
  return response.data.data;
}

export async function addOrganizationScenarioPositionMove(
  scenario: OrganizationScenario,
  positionId: string,
  newParentPositionId: string
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenario>,
    { positionId: string; newParentPositionId: string; version: number }
  >(`${ORG_SCENARIO_BASE}/${scenario.scenarioId}/position-moves`, {
    positionId,
    newParentPositionId,
    version: scenario.version,
  });
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
  }
): Promise<OrganizationScenario> {
  const payload = { ...request, version: scenario.version };
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, typeof payload>(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/positions`,
    payload
  );
  return response.data.data;
}

export async function closeOrganizationScenarioPosition(
  scenario: OrganizationScenario,
  positionId: string
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, { version: number }>(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/positions/${positionId}/close`,
    { version: scenario.version }
  );
  return response.data.data;
}

export async function getOrganizationScenarioDecisionPack(
  scenarioId: string
): Promise<OrganizationScenarioDecisionPack> {
  const response = await axiosInstance.get<ApiResponse<OrganizationScenarioDecisionPack>>(
    `${ORG_SCENARIO_BASE}/${scenarioId}/decision-pack`
  );
  return response.data.data;
}

export async function getOrganizationScenarioDecisionHistory(
  scenarioId: string
): Promise<OrganizationScenarioValidationRun[]> {
  const response = await axiosInstance.get<ApiResponse<OrganizationScenarioValidationRun[]>>(
    `${ORG_SCENARIO_BASE}/${scenarioId}/decision-pack/history`
  );
  return response.data.data;
}

export async function validateOrganizationScenarioDecisionPack(
  scenario: OrganizationScenario
): Promise<OrganizationScenarioDecisionPack> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenarioDecisionPack>,
    { version: number }
  >(`${ORG_SCENARIO_BASE}/${scenario.scenarioId}/decision-pack/validate`, {
    version: scenario.version,
  });
  return response.data.data;
}

export async function removeOrganizationScenarioChange(
  scenario: OrganizationScenario,
  changeId: string
): Promise<OrganizationScenario> {
  const search = new URLSearchParams({ version: String(scenario.version) });
  const response = await axiosInstance.delete<ApiResponse<OrganizationScenario>>(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/changes/${changeId}?${search.toString()}`
  );
  return response.data.data;
}

export async function submitOrganizationScenario(
  scenario: OrganizationScenario,
  reason: string
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenario>,
    { reason: string; version: number }
  >(`${ORG_SCENARIO_BASE}/${scenario.scenarioId}/submit`, {
    reason,
    version: scenario.version,
  });
  return response.data.data;
}

export async function decideOrganizationScenario(
  scenario: OrganizationScenario,
  decision: 'APPROVED' | 'REJECTED',
  reason: string
): Promise<OrganizationScenario> {
  if (!scenario.approval) throw new Error('The scenario has no approval gate.');
  const response = await axiosInstance.post<
    ApiResponse<OrganizationScenario>,
    { decision: string; reason: string; version: number }
  >(`${ORG_SCENARIO_BASE}/${scenario.scenarioId}/approval`, {
    decision,
    reason,
    version: scenario.approval.version,
  });
  return response.data.data;
}

export async function publishOrganizationScenario(
  scenario: OrganizationScenario
): Promise<OrganizationScenario> {
  const response = await axiosInstance.post<ApiResponse<OrganizationScenario>, { version: number }>(
    `${ORG_SCENARIO_BASE}/${scenario.scenarioId}/publish`,
    { version: scenario.version }
  );
  return response.data.data;
}

const HRIS_BASE = '/api/people/v1/admin/integrations/hris';

export async function listHrisSources(): Promise<HrisSourceSystem[]> {
  const response = await axiosInstance.get<ApiResponse<HrisSourceSystem[]>>(`${HRIS_BASE}/sources`);
  return response.data.data;
}

export async function listHrisConnectors(): Promise<HrisConnector[]> {
  const response = await axiosInstance.get<ApiResponse<HrisConnector[]>>(`${HRIS_BASE}/connectors`);
  return response.data.data;
}

export async function createHrisConnector(
  request: CreateHrisConnectorRequest
): Promise<HrisConnector> {
  const response = await axiosInstance.post<ApiResponse<HrisConnector>, CreateHrisConnectorRequest>(
    `${HRIS_BASE}/connectors`,
    request
  );
  return response.data.data;
}

export async function updateHrisConnector(
  connector: HrisConnector,
  request: {
    endpointUri?: string;
    credentialReference?: string;
    scheduleExpression?: string;
    lifecycleState: string;
  }
): Promise<HrisConnector> {
  const response = await axiosInstance.put<
    ApiResponse<HrisConnector>,
    typeof request & { version: number }
  >(`${HRIS_BASE}/connectors/${connector.connectorInstanceId}`, {
    ...request,
    version: connector.version,
  });
  return response.data.data;
}

export async function checkHrisConnectorConfiguration(
  connectorId: string
): Promise<HrisConfigurationCheck> {
  const response = await axiosInstance.post<ApiResponse<HrisConfigurationCheck>, undefined>(
    `${HRIS_BASE}/connectors/${connectorId}/configuration-check`,
    undefined
  );
  return response.data.data;
}

export async function listHrisMappingProfiles(): Promise<HrisMappingProfile[]> {
  const response = await axiosInstance.get<ApiResponse<HrisMappingProfile[]>>(
    `${HRIS_BASE}/mapping-profiles`
  );
  return response.data.data;
}

export async function listHrisSyncRuns(size = 50): Promise<HrisSyncRun[]> {
  const response = await axiosInstance.get<ApiResponse<HrisSyncRun[]>>(
    `${HRIS_BASE}/sync-runs?size=${size}`
  );
  return response.data.data;
}

export async function importSyntheticWorkdayFixture(): Promise<HrisImportResult> {
  const response = await axiosInstance.post<ApiResponse<HrisImportResult>, undefined>(
    `${HRIS_BASE}/sample-import`,
    undefined,
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return response.data.data;
}
