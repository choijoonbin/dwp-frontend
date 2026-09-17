export type DwaionCapabilityStatus = 'AVAILABLE' | 'PARTIAL' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
export type DwaionOperationalHealth = 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';
export type DwaionGovernedCommandState =
  | 'AWAITING_APPROVAL'
  | 'QUEUED'
  | 'RUNNING'
  | 'PARTIAL'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ROLLED_BACK';

export type DwaionControlPlaneCapability = {
  status: DwaionCapabilityStatus;
  configured: boolean;
  reason?: string | null;
  recoveryHint?: string | null;
};

export type DwaionProviderSummary = {
  providerId: string;
  name: string;
  kind: 'MANAGED' | 'PRIVATE' | 'ON_PREMISE';
  region?: string | null;
  health: DwaionOperationalHealth;
  latencyP95Ms?: number | null;
  successRate?: number | null;
  activeModelCount: number;
  updatedAt: string;
};

export type DwaionModelSummary = {
  modelId: string;
  providerId: string;
  displayName: string;
  modalities: string[];
  contextWindow?: number | null;
  lifecycle: 'ACTIVE' | 'CANARY' | 'PAUSED' | 'RETIRED';
  qualityScore?: number | null;
  costPerMillionInputTokens?: number | null;
  costPerMillionOutputTokens?: number | null;
  allowedDataClassifications: string[];
  governancePolicy: string;
  region: string;
  credentialState: 'BOUND' | 'ROTATION_DUE' | 'EXPIRED' | 'MISSING';
  credentialRef: string;
};

export type DwaionRoutingRuleSummary = {
  ruleId: string;
  name: string;
  taskType: string;
  conditions: string[];
  allowedDataClassifications: string[];
  primaryModelId: string;
  fallbackModelIds: string[];
  failClosed: boolean;
  version: number;
};

export type DwaionRoutingSimulationResult = {
  simulationId: string;
  decision: 'ROUTED' | 'BLOCKED' | 'REVIEW_REQUIRED';
  matchedRuleId: string;
  targetModelId?: string | null;
  estimatedCost?: number | null;
  currency: string;
  estimatedLatencyMs?: number | null;
  fallbackModelIds: string[];
  generatedAt: string;
};

export type DwaionRoutingPolicySummary = {
  policyId: string;
  name: string;
  scope: string;
  primaryModelId: string;
  fallbackModelIds: string[];
  budgetMode: 'WARN' | 'THROTTLE' | 'BLOCK';
  dailyBudget?: number | null;
  version: number;
  state: 'ACTIVE' | 'CANARY' | 'PAUSED';
  updatedAt: string;
};

export type DwaionModelsRoutingSnapshot = {
  generatedAt: string;
  capability: DwaionControlPlaneCapability;
  providers: DwaionProviderSummary[];
  models: DwaionModelSummary[];
  routingPolicies: DwaionRoutingPolicySummary[];
  routingRules: DwaionRoutingRuleSummary[];
  latestSimulation?: DwaionRoutingSimulationResult | null;
  pendingApprovalCount: number;
  activeCanaryCount: number;
  emergencyStopActive: boolean;
  monthlySpend?: number | null;
  monthlyBudget?: number | null;
};

export type DwaionConnectorSummary = {
  connectorId: string;
  name: string;
  providerType: string;
  ownerRef: string;
  tenantScope: string;
  region?: string | null;
  repositories: string[];
  health: DwaionOperationalHealth;
  syncState: 'IDLE' | 'SYNCING' | 'PARTIAL' | 'FAILED' | 'PAUSED';
  aclCoverage?: number | null;
  lastSuccessfulSyncAt?: string | null;
  secretExpiresAt?: string | null;
  version: number;
};

export type DwaionConnectorsSnapshot = {
  generatedAt: string;
  capability: DwaionControlPlaneCapability;
  connectors: DwaionConnectorSummary[];
  blockedRepositoryCount: number;
  aclMismatchCount: number;
};

export type DwaionEvaluationDatasetSummary = {
  datasetId: string;
  name: string;
  version: number;
  ownerRef: string;
  caseCount: number;
  piiState: 'PENDING' | 'PASS' | 'REVIEW' | 'BLOCKED';
  checksumSha256?: string | null;
  updatedAt: string;
};

export type DwaionEvaluationComparisonSummary = {
  comparisonId: string;
  baselineLabel: string;
  candidateLabel: string;
  state: 'QUEUED' | 'RUNNING' | 'PARTIAL' | 'COMPLETED' | 'FAILED';
  passRate?: number | null;
  regressionCount?: number | null;
  evaluatorFailureCount?: number | null;
  datasetId?: string | null;
  datasetVersion?: number | null;
  resultVersion?: number | null;
  createdAt: string;
};

export type DwaionDriftSignal = {
  signalId: string;
  label: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  currentValue?: number | null;
  threshold?: number | null;
  affectedScope: string;
  detectedAt: string;
  anonymizedSample?: string | null;
  feedbackEvidenceRef?: string | null;
  approvedRawAccess?: boolean;
  rollbackRecommendation?: string | null;
};

export type DwaionEvaluationSafetySnapshot = {
  generatedAt: string;
  capability: DwaionControlPlaneCapability;
  datasets: DwaionEvaluationDatasetSummary[];
  comparisons: DwaionEvaluationComparisonSummary[];
  driftSignals: DwaionDriftSignal[];
  releaseGateState: 'PASS' | 'REVIEW' | 'BLOCKED' | 'UNKNOWN';
};

export type DwaionIncidentSummary = {
  incidentId: string;
  title: string;
  severity: 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
  state: 'OPEN' | 'CONTAINED' | 'VALIDATING' | 'RECOVERY_PENDING' | 'RECOVERED' | 'CLOSED';
  affectedRunCount: number;
  affectedUserCount?: number | null;
  scope: string;
  ownerRef?: string | null;
  correlationId: string;
  openedAt: string;
  updatedAt: string;
  version: number;
  timeline: Array<{
    eventId: string;
    type: string;
    summary: string;
    actorRef?: string | null;
    occurredAt: string;
    evidenceRefs: string[];
  }>;
};

export type DwaionIncidentsSnapshot = {
  generatedAt: string;
  capability: DwaionControlPlaneCapability;
  incidents: DwaionIncidentSummary[];
  quarantinedRunCount: number;
  recoveryApprovalCount: number;
};

export type DwaionOutcomeMetric = {
  metricKey: string;
  label: string;
  value?: number | null;
  unit: 'COUNT' | 'PERCENT' | 'MILLISECONDS' | 'CURRENCY' | 'TOKENS';
  denominator?: number | null;
  previousValue?: number | null;
  freshnessAt: string;
};

export type DwaionOutcomeCohort = {
  cohortKey: string;
  label: string;
  completedWorkCount: number;
  completionRate?: number | null;
  reworkRate?: number | null;
  rollbackRate?: number | null;
  costPerCompletedWork?: number | null;
};

export type DwaionImprovementBacklogItem = {
  itemId: string;
  title: string;
  ownerTeam: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  metricEvidence: string;
  problemCluster: string;
  targetValue?: string | null;
  linkedRelease?: string | null;
  state: 'PROPOSED' | 'APPROVED' | 'IN_PROGRESS' | 'DONE';
  version: number;
};

export type DwaionTokenBudgetSummary = {
  scope: string;
  consumedTokens: number;
  budgetTokens: number | null;
  projectedTokens?: number | null;
  spikeDetected: boolean;
  policyMode: 'WARN' | 'THROTTLE' | 'BLOCK';
  enforcementActivationState: 'ENABLED' | 'DISABLED';
  version: number;
};

export type DwaionOutcomesSnapshot = {
  generatedAt: string;
  periodDays: number;
  capability: DwaionControlPlaneCapability;
  privacyThreshold: number;
  suppressedCohortCount: number;
  metrics: DwaionOutcomeMetric[];
  cohorts: DwaionOutcomeCohort[];
  backlog: DwaionImprovementBacklogItem[];
  tokenBudgets: DwaionTokenBudgetSummary[];
  currency: string;
};

export type DwaionGovernedCommandKind =
  | 'MODEL_ROUTING_UPDATE'
  | 'MODEL_ROUTING_DRAFT_SAVE'
  | 'MODEL_ROUTE_SIMULATE'
  | 'MODEL_CANARY_START'
  | 'MODEL_ROLLBACK'
  | 'PROVIDER_CIRCUIT_BREAK'
  | 'MODEL_SMART_ISOLATE'
  | 'EMERGENCY_STOP'
  | 'EMERGENCY_RECOVERY'
  | 'EMERGENCY_RECOVERY_SIMULATE'
  | 'EMERGENCY_ISOLATION_ROLLBACK'
  | 'AGENT_PROMOTE'
  | 'AGENT_DRAFT_SAVE'
  | 'AGENT_EVALUATE'
  | 'AGENT_EVALUATION_CERT_SIGN'
  | 'AGENT_ROLLBACK'
  | 'AGENT_KILL_SWITCH'
  | 'CONNECTOR_CREATE'
  | 'CONNECTOR_DRAFT_SAVE'
  | 'CONNECTOR_PROBE'
  | 'CONNECTOR_OAUTH_REAUTHORIZE'
  | 'CONNECTOR_PAUSE'
  | 'CONNECTOR_QUARANTINE'
  | 'CONNECTOR_DRIFT_HEAL'
  | 'CONNECTOR_KILL_SWITCH'
  | 'CONNECTOR_SYNC'
  | 'CONNECTOR_REINDEX'
  | 'CONNECTOR_SECRET_ROTATE'
  | 'CONNECTOR_SCOPE_REDUCE'
  | 'CONNECTOR_REVOKE'
  | 'CONNECTOR_DELETE'
  | 'DATASET_IMPORT'
  | 'DATASET_PII_DECIDE'
  | 'EVALUATION_COMPARE'
  | 'EVALUATION_RUN'
  | 'EVALUATION_RERUN'
  | 'EVALUATION_REPORT_EXPORT'
  | 'EVALUATION_GATE_APPROVE'
  | 'SAFETY_SIMULATE'
  | 'SAFETY_GUARDRAIL_ENFORCE'
  | 'SAFETY_CANARY_APPROVE'
  | 'DRIFT_EVIDENCE_ATTACH'
  | 'DRIFT_RAW_EVIDENCE_REQUEST'
  | 'INCIDENT_CONTAIN'
  | 'INCIDENT_EMERGENCY_STOP'
  | 'INCIDENT_WAR_ROOM_OPEN'
  | 'INCIDENT_REPORT_EXPORT'
  | 'INCIDENT_VALIDATION_RUN'
  | 'INCIDENT_CONNECTOR_REAUTH'
  | 'INCIDENT_SAFE_ROLLBACK'
  | 'INCIDENT_RECOVERY_RESYNC'
  | 'INCIDENT_SKIP_QUARANTINED'
  | 'INCIDENT_ROUTINE_PAUSE'
  | 'RUN_QUARANTINE'
  | 'RUN_REPLAY'
  | 'RUN_COMPENSATE'
  | 'INCIDENT_RECOVERY'
  | 'INCIDENT_CLOSE'
  | 'BACKLOG_CREATE'
  | 'BACKLOG_UPDATE'
  | 'BACKLOG_TICKET_OPEN'
  | 'BACKLOG_RELEASE_LINK'
  | 'OUTCOME_EXPORT'
  | 'COST_SIMULATE'
  | 'TOKEN_BUDGET_UPDATE';

export type DwaionAdminCommandCapability = {
  kind: DwaionGovernedCommandKind;
  family: 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A06';
  executionMode: 'INTERNAL' | 'EXTERNAL_ADAPTER';
  status: DwaionCapabilityStatus;
  configured: boolean;
  reason?: string | null;
  recoveryHint?: string | null;
};

export type DwaionAdminCommandCapabilitiesSnapshot = {
  generatedAt: string;
  workerAvailable: boolean;
  commands: DwaionAdminCommandCapability[];
};

export type DwaionGovernedCommandRequest = {
  commandId: string;
  kind: DwaionGovernedCommandKind;
  target: { type: string; id: string };
  expectedVersion: number;
  reason: string;
  ticketRef: string;
  evidenceRefs: string[];
  impactAcknowledged: true;
  preflight: {
    changes: Array<{ field: string; before: string; after: string }>;
    impactScopes: string[];
    recoveryPlan: string;
    recoveryPlanHash: string;
  };
  payload: Record<string, unknown>;
};

export type DwaionGovernedCommandReview = {
  reason: string;
  ticketRef: string;
  evidenceRefs: string[];
  preflight: DwaionGovernedCommandRequest['preflight'];
};

export type DwaionGovernedCommandReceipt = {
  receiptId: string;
  auditEventId: string;
  completedAt: string;
  resultSummary: string;
  domainReceiptRef?: string | null;
  rollbackRef?: string | null;
};

export type DwaionGovernedCommand = {
  commandId: string;
  kind: DwaionGovernedCommandKind;
  state: DwaionGovernedCommandState;
  target: { type: string; id: string };
  expectedVersion: number;
  makerUserId?: string | null;
  checkerUserId?: string | null;
  approvalRequired: boolean;
  canApprove: boolean;
  review: DwaionGovernedCommandReview;
  allowedTransitions: Array<'APPROVE' | 'REJECT' | 'CANCEL' | 'RETRY' | 'ROLLBACK'>;
  transitionBlockReason?: string | null;
  progressPercent?: number | null;
  createdAt: string;
  updatedAt: string;
  receipt?: DwaionGovernedCommandReceipt | null;
  problem?: { code: string; detail: string; recoveryHint?: string | null } | null;
  version: number;
  decision?: {
    decision: 'APPROVE' | 'REJECT';
    actorUserId: string;
    reason: string;
    evidenceRefs: string[];
    decidedAt: string;
  } | null;
};

export type DwaionGovernedCommandsSnapshot = {
  generatedAt: string;
  commands: DwaionGovernedCommand[];
};

export type DwaionGovernedCommandDecisionRequest = {
  commandId: string;
  decision: 'APPROVE' | 'REJECT';
  expectedVersion: number;
  reason: string;
  evidenceRefs: string[];
};

export type DwaionGovernedCommandTransitionRequest = {
  commandId: string;
  expectedVersion: number;
  reason: string;
  evidenceRefs: string[];
};

export type DwaionGovernedCommandRestartRequest = DwaionGovernedCommandTransitionRequest;
