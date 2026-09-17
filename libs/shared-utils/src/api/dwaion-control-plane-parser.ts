import { HttpError } from '../http-error';

import type {
  DwaionConnectorsSnapshot,
  DwaionEvaluationSafetySnapshot,
  DwaionGovernedCommand,
  DwaionGovernedCommandKind,
  DwaionGovernedCommandState,
  DwaionGovernedCommandsSnapshot,
  DwaionIncidentsSnapshot,
  DwaionModelsRoutingSnapshot,
  DwaionOutcomesSnapshot,
} from './dwaion-control-plane-contract';

type JsonRecord = Record<string, unknown>;

const CAPABILITY_STATES = new Set(['AVAILABLE', 'PARTIAL', 'NOT_CONFIGURED', 'UNAVAILABLE']);
const HEALTH_STATES = new Set(['HEALTHY', 'DEGRADED', 'FAILED', 'UNKNOWN']);
const PROVIDER_KINDS = new Set(['MANAGED', 'PRIVATE', 'ON_PREMISE']);
const MODEL_LIFECYCLES = new Set(['ACTIVE', 'CANARY', 'PAUSED', 'RETIRED']);
const CREDENTIAL_STATES = new Set(['BOUND', 'ROTATION_DUE', 'EXPIRED', 'MISSING']);
const ROUTING_DECISIONS = new Set(['ROUTED', 'BLOCKED', 'REVIEW_REQUIRED']);
const BUDGET_MODES = new Set(['WARN', 'THROTTLE', 'BLOCK']);
const ENFORCEMENT_ACTIVATION_STATES = new Set(['ENABLED', 'DISABLED']);
const ROUTING_STATES = new Set(['ACTIVE', 'CANARY', 'PAUSED']);
const CONNECTOR_SYNC_STATES = new Set(['IDLE', 'SYNCING', 'PARTIAL', 'FAILED', 'PAUSED']);
const DATASET_PII_STATES = new Set(['PENDING', 'PASS', 'REVIEW', 'BLOCKED']);
const COMPARISON_STATES = new Set(['QUEUED', 'RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED']);
const DRIFT_SEVERITIES = new Set(['INFO', 'WARNING', 'CRITICAL']);
const RELEASE_GATE_STATES = new Set(['PASS', 'REVIEW', 'BLOCKED', 'UNKNOWN']);
const INCIDENT_SEVERITIES = new Set(['SEV1', 'SEV2', 'SEV3', 'SEV4']);
const INCIDENT_STATES = new Set([
  'OPEN',
  'CONTAINED',
  'VALIDATING',
  'RECOVERY_PENDING',
  'RECOVERED',
  'CLOSED',
]);
const OUTCOME_UNITS = new Set(['COUNT', 'PERCENT', 'MILLISECONDS', 'CURRENCY', 'TOKENS']);
const BACKLOG_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const BACKLOG_STATES = new Set(['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'DONE']);
const COMMAND_STATES = new Set([
  'AWAITING_APPROVAL',
  'QUEUED',
  'RUNNING',
  'PARTIAL',
  'SUCCEEDED',
  'FAILED',
  'REJECTED',
  'CANCELLED',
  'ROLLED_BACK',
]);
const COMMAND_TRANSITIONS = new Set(['APPROVE', 'REJECT', 'CANCEL', 'RETRY', 'ROLLBACK']);
export const DWAION_GOVERNED_COMMAND_KINDS: ReadonlySet<DwaionGovernedCommandKind> = new Set([
  'MODEL_ROUTING_UPDATE',
  'MODEL_ROUTING_DRAFT_SAVE',
  'MODEL_ROUTE_SIMULATE',
  'MODEL_CANARY_START',
  'MODEL_ROLLBACK',
  'PROVIDER_CIRCUIT_BREAK',
  'MODEL_SMART_ISOLATE',
  'EMERGENCY_STOP',
  'EMERGENCY_RECOVERY',
  'EMERGENCY_RECOVERY_SIMULATE',
  'EMERGENCY_ISOLATION_ROLLBACK',
  'AGENT_PROMOTE',
  'AGENT_DRAFT_SAVE',
  'AGENT_EVALUATE',
  'AGENT_EVALUATION_CERT_SIGN',
  'AGENT_ROLLBACK',
  'AGENT_KILL_SWITCH',
  'CONNECTOR_CREATE',
  'CONNECTOR_DRAFT_SAVE',
  'CONNECTOR_PROBE',
  'CONNECTOR_OAUTH_REAUTHORIZE',
  'CONNECTOR_PAUSE',
  'CONNECTOR_QUARANTINE',
  'CONNECTOR_DRIFT_HEAL',
  'CONNECTOR_KILL_SWITCH',
  'CONNECTOR_SYNC',
  'CONNECTOR_REINDEX',
  'CONNECTOR_SECRET_ROTATE',
  'CONNECTOR_SCOPE_REDUCE',
  'CONNECTOR_REVOKE',
  'CONNECTOR_DELETE',
  'DATASET_IMPORT',
  'DATASET_PII_DECIDE',
  'EVALUATION_COMPARE',
  'EVALUATION_RUN',
  'EVALUATION_RERUN',
  'EVALUATION_REPORT_EXPORT',
  'EVALUATION_GATE_APPROVE',
  'SAFETY_SIMULATE',
  'SAFETY_GUARDRAIL_ENFORCE',
  'SAFETY_CANARY_APPROVE',
  'DRIFT_EVIDENCE_ATTACH',
  'DRIFT_RAW_EVIDENCE_REQUEST',
  'INCIDENT_CONTAIN',
  'INCIDENT_EMERGENCY_STOP',
  'INCIDENT_WAR_ROOM_OPEN',
  'INCIDENT_REPORT_EXPORT',
  'INCIDENT_VALIDATION_RUN',
  'INCIDENT_CONNECTOR_REAUTH',
  'INCIDENT_SAFE_ROLLBACK',
  'INCIDENT_RECOVERY_RESYNC',
  'INCIDENT_SKIP_QUARANTINED',
  'INCIDENT_ROUTINE_PAUSE',
  'RUN_QUARANTINE',
  'RUN_REPLAY',
  'RUN_COMPENSATE',
  'INCIDENT_RECOVERY',
  'INCIDENT_CLOSE',
  'BACKLOG_CREATE',
  'BACKLOG_UPDATE',
  'BACKLOG_TICKET_OPEN',
  'BACKLOG_RELEASE_LINK',
  'OUTCOME_EXPORT',
  'COST_SIMULATE',
  'TOKEN_BUDGET_UPDATE',
]);

export function isDwaionGovernedCommandKind(value: unknown): value is DwaionGovernedCommandKind {
  return (
    typeof value === 'string' &&
    DWAION_GOVERNED_COMMAND_KINDS.has(value as DwaionGovernedCommandKind)
  );
}
const SHA_256 = /^[a-f\d]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(label: string): never {
  throw new HttpError(`DWAI-ON control-plane ${label} response is invalid.`, 502);
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(label);
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) invalid(label);
  return value;
}

function text(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) invalid(label);
  return value;
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label);
  if (!Number.isFinite(Date.parse(result))) invalid(label);
  return result;
}

function optionalText(value: unknown, label: string): void {
  if (value != null) text(value, label);
}

function optionalTimestamp(value: unknown, label: string): void {
  if (value != null) timestamp(value, label);
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(label);
  return value;
}

function optionalFinite(value: unknown, label: string): number | null | undefined {
  if (value === undefined || value === null) return value;
  return finite(value, label);
}

function nonNegative(value: unknown, label: string): number {
  const result = finite(value, label);
  if (result < 0) invalid(label);
  return result;
}

function optionalNonNegative(value: unknown, label: string): void {
  if (value != null) nonNegative(value, label);
}

function positive(value: unknown, label: string): number {
  const result = finite(value, label);
  if (result <= 0) invalid(label);
  return result;
}

function optionalPositive(value: unknown, label: string): void {
  if (value != null) positive(value, label);
}

function nonNegativeInteger(value: unknown, label: string): number {
  const result = nonNegative(value, label);
  if (!Number.isSafeInteger(result)) invalid(label);
  return result;
}

function optionalNonNegativeInteger(value: unknown, label: string): void {
  if (value != null) nonNegativeInteger(value, label);
}

function positiveInteger(value: unknown, label: string): number {
  const result = nonNegativeInteger(value, label);
  if (result < 1) invalid(label);
  return result;
}

function bounded(value: unknown, min: number, max: number, label: string): number {
  const result = finite(value, label);
  if (result < min || result > max) invalid(label);
  return result;
}

function optionalPercentage(value: unknown, label: string): void {
  if (value != null) bounded(value, 0, 100, label);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') invalid(label);
  return value;
}

function enumValue(value: unknown, choices: ReadonlySet<string>, label: string): string {
  if (typeof value !== 'string' || !choices.has(value)) invalid(label);
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  return array(value, label).map((item, index) => text(item, `${label}[${index}]`));
}

function uniqueStrings(values: string[], label: string): void {
  if (new Set(values).size !== values.length) invalid(label);
}

function uniqueRecords(records: unknown[], key: string, label: string): Set<string> {
  const ids = records.map((candidate, index) =>
    text(record(candidate, `${label}[${index}]`)[key], `${label}[${index}].${key}`)
  );
  uniqueStrings(ids, `${label}.${key}`);
  return new Set(ids);
}

function validateCapability(value: unknown, label: string): void {
  const item = record(value, label);
  enumValue(item.status, CAPABILITY_STATES, `${label}.status`);
  boolean(item.configured, `${label}.configured`);
  optionalText(item.reason, `${label}.reason`);
  optionalText(item.recoveryHint, `${label}.recoveryHint`);
}

function validateCommonSnapshot(value: unknown, label: string): JsonRecord {
  const snapshot = record(value, label);
  timestamp(snapshot.generatedAt, `${label}.generatedAt`);
  validateCapability(snapshot.capability, `${label}.capability`);
  return snapshot;
}

export function parseDwaionModelsRouting(value: unknown): DwaionModelsRoutingSnapshot {
  const snapshot = validateCommonSnapshot(value, 'models-routing');
  const providers = array(snapshot.providers, 'models-routing.providers');
  const models = array(snapshot.models, 'models-routing.models');
  const policies = array(snapshot.routingPolicies, 'models-routing.routingPolicies');
  const rules = array(snapshot.routingRules, 'models-routing.routingRules');
  const providerIds = uniqueRecords(providers, 'providerId', 'providers');
  const modelIds = uniqueRecords(models, 'modelId', 'models');
  uniqueRecords(policies, 'policyId', 'routingPolicies');
  const ruleIds = uniqueRecords(rules, 'ruleId', 'routingRules');

  providers.forEach((candidate, index) => {
    const label = `providers[${index}]`;
    const item = record(candidate, label);
    text(item.name, `${label}.name`);
    enumValue(item.kind, PROVIDER_KINDS, `${label}.kind`);
    optionalText(item.region, `${label}.region`);
    enumValue(item.health, HEALTH_STATES, `${label}.health`);
    optionalNonNegative(item.latencyP95Ms, `${label}.latencyP95Ms`);
    optionalPercentage(item.successRate, `${label}.successRate`);
    nonNegativeInteger(item.activeModelCount, `${label}.activeModelCount`);
    timestamp(item.updatedAt, `${label}.updatedAt`);
  });
  models.forEach((candidate, index) => {
    const label = `models[${index}]`;
    const item = record(candidate, label);
    const providerId = text(item.providerId, `${label}.providerId`);
    if (!providerIds.has(providerId)) invalid(`${label}.providerId`);
    text(item.displayName, `${label}.displayName`);
    const modalities = stringArray(item.modalities, `${label}.modalities`);
    uniqueStrings(modalities, `${label}.modalities`);
    if (item.contextWindow != null) positiveInteger(item.contextWindow, `${label}.contextWindow`);
    enumValue(item.lifecycle, MODEL_LIFECYCLES, `${label}.lifecycle`);
    optionalPercentage(item.qualityScore, `${label}.qualityScore`);
    optionalNonNegative(item.costPerMillionInputTokens, `${label}.costPerMillionInputTokens`);
    optionalNonNegative(item.costPerMillionOutputTokens, `${label}.costPerMillionOutputTokens`);
    const classifications = stringArray(
      item.allowedDataClassifications,
      `${label}.allowedDataClassifications`
    );
    if (classifications.length === 0) invalid(`${label}.allowedDataClassifications`);
    uniqueStrings(classifications, `${label}.allowedDataClassifications`);
    text(item.governancePolicy, `${label}.governancePolicy`);
    text(item.region, `${label}.region`);
    enumValue(item.credentialState, CREDENTIAL_STATES, `${label}.credentialState`);
    text(item.credentialRef, `${label}.credentialRef`);
  });
  policies.forEach((candidate, index) => {
    const label = `routingPolicies[${index}]`;
    const item = record(candidate, label);
    text(item.name, `${label}.name`);
    text(item.scope, `${label}.scope`);
    const primaryModelId = text(item.primaryModelId, `${label}.primaryModelId`);
    if (!modelIds.has(primaryModelId)) invalid(`${label}.primaryModelId`);
    const fallbackModelIds = stringArray(item.fallbackModelIds, `${label}.fallbackModelIds`);
    uniqueStrings(fallbackModelIds, `${label}.fallbackModelIds`);
    if (fallbackModelIds.includes(primaryModelId)) invalid(`${label}.fallbackModelIds`);
    fallbackModelIds.forEach((modelId) => {
      if (!modelIds.has(modelId)) invalid(`${label}.fallbackModelIds`);
    });
    enumValue(item.budgetMode, BUDGET_MODES, `${label}.budgetMode`);
    optionalPositive(item.dailyBudget, `${label}.dailyBudget`);
    positiveInteger(item.version, `${label}.version`);
    enumValue(item.state, ROUTING_STATES, `${label}.state`);
    timestamp(item.updatedAt, `${label}.updatedAt`);
  });
  rules.forEach((candidate, index) => {
    const label = `routingRules[${index}]`;
    const item = record(candidate, label);
    text(item.name, `${label}.name`);
    text(item.taskType, `${label}.taskType`);
    const conditions = stringArray(item.conditions, `${label}.conditions`);
    if (conditions.length === 0) invalid(`${label}.conditions`);
    uniqueStrings(conditions, `${label}.conditions`);
    const classifications = stringArray(
      item.allowedDataClassifications,
      `${label}.allowedDataClassifications`
    );
    if (classifications.length === 0) invalid(`${label}.allowedDataClassifications`);
    uniqueStrings(classifications, `${label}.allowedDataClassifications`);
    const primaryModelId = text(item.primaryModelId, `${label}.primaryModelId`);
    if (!modelIds.has(primaryModelId)) invalid(`${label}.primaryModelId`);
    const fallbacks = stringArray(item.fallbackModelIds, `${label}.fallbackModelIds`);
    uniqueStrings(fallbacks, `${label}.fallbackModelIds`);
    fallbacks.forEach((modelId) => {
      if (!modelIds.has(modelId) || modelId === primaryModelId)
        invalid(`${label}.fallbackModelIds`);
    });
    boolean(item.failClosed, `${label}.failClosed`);
    positiveInteger(item.version, `${label}.version`);
  });
  if (snapshot.latestSimulation != null) {
    const simulation = record(snapshot.latestSimulation, 'models-routing.latestSimulation');
    text(simulation.simulationId, 'models-routing.latestSimulation.simulationId');
    enumValue(simulation.decision, ROUTING_DECISIONS, 'models-routing.latestSimulation.decision');
    const matchedRuleId = text(
      simulation.matchedRuleId,
      'models-routing.latestSimulation.matchedRuleId'
    );
    if (!ruleIds.has(matchedRuleId)) invalid('models-routing.latestSimulation.matchedRuleId');
    if (simulation.targetModelId != null) {
      const targetModelId = text(
        simulation.targetModelId,
        'models-routing.latestSimulation.targetModelId'
      );
      if (!modelIds.has(targetModelId)) invalid('models-routing.latestSimulation.targetModelId');
    }
    optionalNonNegative(simulation.estimatedCost, 'models-routing.latestSimulation.estimatedCost');
    text(simulation.currency, 'models-routing.latestSimulation.currency');
    optionalNonNegative(
      simulation.estimatedLatencyMs,
      'models-routing.latestSimulation.estimatedLatencyMs'
    );
    const fallbackIds = stringArray(
      simulation.fallbackModelIds,
      'models-routing.latestSimulation.fallbackModelIds'
    );
    uniqueStrings(fallbackIds, 'models-routing.latestSimulation.fallbackModelIds');
    fallbackIds.forEach((modelId) => {
      if (!modelIds.has(modelId)) invalid('models-routing.latestSimulation.fallbackModelIds');
    });
    timestamp(simulation.generatedAt, 'models-routing.latestSimulation.generatedAt');
  }
  nonNegativeInteger(snapshot.pendingApprovalCount, 'models-routing.pendingApprovalCount');
  nonNegativeInteger(snapshot.activeCanaryCount, 'models-routing.activeCanaryCount');
  boolean(snapshot.emergencyStopActive, 'models-routing.emergencyStopActive');
  optionalNonNegative(snapshot.monthlySpend, 'models-routing.monthlySpend');
  optionalPositive(snapshot.monthlyBudget, 'models-routing.monthlyBudget');
  return snapshot as DwaionModelsRoutingSnapshot;
}

export function parseDwaionConnectors(value: unknown): DwaionConnectorsSnapshot {
  const snapshot = validateCommonSnapshot(value, 'connectors');
  const connectors = array(snapshot.connectors, 'connectors.items');
  uniqueRecords(connectors, 'connectorId', 'connectors');
  connectors.forEach((candidate, index) => {
    const label = `connectors[${index}]`;
    const item = record(candidate, label);
    text(item.name, `${label}.name`);
    text(item.providerType, `${label}.providerType`);
    text(item.ownerRef, `${label}.ownerRef`);
    text(item.tenantScope, `${label}.tenantScope`);
    optionalText(item.region, `${label}.region`);
    const repositories = stringArray(item.repositories, `${label}.repositories`);
    uniqueStrings(repositories, `${label}.repositories`);
    enumValue(item.health, HEALTH_STATES, `${label}.health`);
    enumValue(item.syncState, CONNECTOR_SYNC_STATES, `${label}.syncState`);
    optionalPercentage(item.aclCoverage, `${label}.aclCoverage`);
    optionalTimestamp(item.lastSuccessfulSyncAt, `${label}.lastSuccessfulSyncAt`);
    optionalTimestamp(item.secretExpiresAt, `${label}.secretExpiresAt`);
    positiveInteger(item.version, `${label}.version`);
  });
  nonNegativeInteger(snapshot.blockedRepositoryCount, 'connectors.blockedRepositoryCount');
  nonNegativeInteger(snapshot.aclMismatchCount, 'connectors.aclMismatchCount');
  return snapshot as DwaionConnectorsSnapshot;
}

export function parseDwaionEvaluationSafety(value: unknown): DwaionEvaluationSafetySnapshot {
  const snapshot = validateCommonSnapshot(value, 'evaluation-safety');
  const datasets = array(snapshot.datasets, 'evaluation-safety.datasets');
  const comparisons = array(snapshot.comparisons, 'evaluation-safety.comparisons');
  const signals = array(snapshot.driftSignals, 'evaluation-safety.driftSignals');
  uniqueRecords(datasets, 'datasetId', 'datasets');
  uniqueRecords(comparisons, 'comparisonId', 'comparisons');
  uniqueRecords(signals, 'signalId', 'driftSignals');
  datasets.forEach((candidate, index) => {
    const label = `datasets[${index}]`;
    const item = record(candidate, label);
    text(item.name, `${label}.name`);
    positiveInteger(item.version, `${label}.version`);
    text(item.ownerRef, `${label}.ownerRef`);
    nonNegativeInteger(item.caseCount, `${label}.caseCount`);
    enumValue(item.piiState, DATASET_PII_STATES, `${label}.piiState`);
    if (
      item.checksumSha256 != null &&
      !SHA_256.test(text(item.checksumSha256, `${label}.checksumSha256`))
    ) {
      invalid(`${label}.checksumSha256`);
    }
    timestamp(item.updatedAt, `${label}.updatedAt`);
  });
  comparisons.forEach((candidate, index) => {
    const label = `comparisons[${index}]`;
    const item = record(candidate, label);
    text(item.baselineLabel, `${label}.baselineLabel`);
    text(item.candidateLabel, `${label}.candidateLabel`);
    enumValue(item.state, COMPARISON_STATES, `${label}.state`);
    optionalPercentage(item.passRate, `${label}.passRate`);
    optionalNonNegativeInteger(item.regressionCount, `${label}.regressionCount`);
    optionalNonNegativeInteger(item.evaluatorFailureCount, `${label}.evaluatorFailureCount`);
    optionalText(item.datasetId, `${label}.datasetId`);
    if (item.datasetVersion != null) {
      positiveInteger(item.datasetVersion, `${label}.datasetVersion`);
    }
    if (item.resultVersion != null) {
      positiveInteger(item.resultVersion, `${label}.resultVersion`);
    }
    timestamp(item.createdAt, `${label}.createdAt`);
  });
  signals.forEach((candidate, index) => {
    const label = `driftSignals[${index}]`;
    const item = record(candidate, label);
    text(item.label, `${label}.label`);
    enumValue(item.severity, DRIFT_SEVERITIES, `${label}.severity`);
    optionalFinite(item.currentValue, `${label}.currentValue`);
    optionalFinite(item.threshold, `${label}.threshold`);
    text(item.affectedScope, `${label}.affectedScope`);
    timestamp(item.detectedAt, `${label}.detectedAt`);
    optionalText(item.anonymizedSample, `${label}.anonymizedSample`);
    optionalText(item.feedbackEvidenceRef, `${label}.feedbackEvidenceRef`);
    if (item.approvedRawAccess != null)
      boolean(item.approvedRawAccess, `${label}.approvedRawAccess`);
    optionalText(item.rollbackRecommendation, `${label}.rollbackRecommendation`);
  });
  enumValue(snapshot.releaseGateState, RELEASE_GATE_STATES, 'evaluation-safety.releaseGateState');
  return snapshot as DwaionEvaluationSafetySnapshot;
}

export function parseDwaionIncidents(value: unknown): DwaionIncidentsSnapshot {
  const snapshot = validateCommonSnapshot(value, 'incidents');
  const incidents = array(snapshot.incidents, 'incidents.items');
  uniqueRecords(incidents, 'incidentId', 'incidents');
  incidents.forEach((candidate, index) => {
    const label = `incidents[${index}]`;
    const item = record(candidate, label);
    text(item.title, `${label}.title`);
    enumValue(item.severity, INCIDENT_SEVERITIES, `${label}.severity`);
    enumValue(item.state, INCIDENT_STATES, `${label}.state`);
    nonNegativeInteger(item.affectedRunCount, `${label}.affectedRunCount`);
    optionalNonNegativeInteger(item.affectedUserCount, `${label}.affectedUserCount`);
    text(item.scope, `${label}.scope`);
    optionalText(item.ownerRef, `${label}.ownerRef`);
    text(item.correlationId, `${label}.correlationId`);
    timestamp(item.openedAt, `${label}.openedAt`);
    timestamp(item.updatedAt, `${label}.updatedAt`);
    positiveInteger(item.version, `${label}.version`);
    const timeline = array(item.timeline, `${label}.timeline`);
    uniqueRecords(timeline, 'eventId', `${label}.timeline`);
    timeline.forEach((candidate, eventIndex) => {
      const eventLabel = `${label}.timeline[${eventIndex}]`;
      const event = record(candidate, eventLabel);
      text(event.type, `${eventLabel}.type`);
      text(event.summary, `${eventLabel}.summary`);
      optionalText(event.actorRef, `${eventLabel}.actorRef`);
      timestamp(event.occurredAt, `${eventLabel}.occurredAt`);
      stringArray(event.evidenceRefs, `${eventLabel}.evidenceRefs`);
    });
  });
  nonNegativeInteger(snapshot.quarantinedRunCount, 'incidents.quarantinedRunCount');
  nonNegativeInteger(snapshot.recoveryApprovalCount, 'incidents.recoveryApprovalCount');
  return snapshot as DwaionIncidentsSnapshot;
}

export function parseDwaionOutcomes(value: unknown): DwaionOutcomesSnapshot {
  const snapshot = validateCommonSnapshot(value, 'outcomes');
  const periodDays = positiveInteger(snapshot.periodDays, 'outcomes.periodDays');
  if (periodDays > 90) invalid('outcomes.periodDays');
  positiveInteger(snapshot.privacyThreshold, 'outcomes.privacyThreshold');
  nonNegativeInteger(snapshot.suppressedCohortCount, 'outcomes.suppressedCohortCount');
  text(snapshot.currency, 'outcomes.currency');
  const metrics = array(snapshot.metrics, 'outcomes.metrics');
  const cohorts = array(snapshot.cohorts, 'outcomes.cohorts');
  const backlog = array(snapshot.backlog, 'outcomes.backlog');
  const budgets = array(snapshot.tokenBudgets, 'outcomes.tokenBudgets');
  uniqueRecords(metrics, 'metricKey', 'metrics');
  uniqueRecords(cohorts, 'cohortKey', 'cohorts');
  uniqueRecords(backlog, 'itemId', 'backlog');
  uniqueRecords(budgets, 'scope', 'tokenBudgets');
  metrics.forEach((candidate, index) => {
    const label = `metrics[${index}]`;
    const item = record(candidate, label);
    text(item.label, `${label}.label`);
    const unit = enumValue(item.unit, OUTCOME_UNITS, `${label}.unit`);
    if (unit === 'PERCENT') {
      optionalPercentage(item.value, `${label}.value`);
      optionalPercentage(item.previousValue, `${label}.previousValue`);
    } else {
      optionalNonNegative(item.value, `${label}.value`);
      optionalNonNegative(item.previousValue, `${label}.previousValue`);
    }
    optionalNonNegativeInteger(item.denominator, `${label}.denominator`);
    timestamp(item.freshnessAt, `${label}.freshnessAt`);
  });
  cohorts.forEach((candidate, index) => {
    const label = `cohorts[${index}]`;
    const item = record(candidate, label);
    text(item.label, `${label}.label`);
    nonNegativeInteger(item.completedWorkCount, `${label}.completedWorkCount`);
    optionalPercentage(item.completionRate, `${label}.completionRate`);
    optionalPercentage(item.reworkRate, `${label}.reworkRate`);
    optionalPercentage(item.rollbackRate, `${label}.rollbackRate`);
    optionalNonNegative(item.costPerCompletedWork, `${label}.costPerCompletedWork`);
  });
  backlog.forEach((candidate, index) => {
    const label = `backlog[${index}]`;
    const item = record(candidate, label);
    text(item.title, `${label}.title`);
    text(item.ownerTeam, `${label}.ownerTeam`);
    enumValue(item.priority, BACKLOG_PRIORITIES, `${label}.priority`);
    text(item.metricEvidence, `${label}.metricEvidence`);
    text(item.problemCluster, `${label}.problemCluster`);
    optionalText(item.targetValue, `${label}.targetValue`);
    optionalText(item.linkedRelease, `${label}.linkedRelease`);
    enumValue(item.state, BACKLOG_STATES, `${label}.state`);
    positiveInteger(item.version, `${label}.version`);
  });
  budgets.forEach((candidate, index) => {
    const label = `tokenBudgets[${index}]`;
    const item = record(candidate, label);
    const consumed = nonNegativeInteger(item.consumedTokens, `${label}.consumedTokens`);
    const budget =
      item.budgetTokens == null
        ? null
        : positiveInteger(item.budgetTokens, `${label}.budgetTokens`);
    optionalNonNegativeInteger(item.projectedTokens, `${label}.projectedTokens`);
    boolean(item.spikeDetected, `${label}.spikeDetected`);
    const policyMode = enumValue(item.policyMode, BUDGET_MODES, `${label}.policyMode`);
    const activationState = enumValue(
      item.enforcementActivationState,
      ENFORCEMENT_ACTIVATION_STATES,
      `${label}.enforcementActivationState`
    );
    if (
      policyMode === 'BLOCK' &&
      activationState === 'ENABLED' &&
      budget != null &&
      consumed > budget
    ) {
      invalid(`${label}.consumedTokens`);
    }
    positiveInteger(item.version, `${label}.version`);
  });
  return snapshot as DwaionOutcomesSnapshot;
}

export function parseDwaionGovernedCommand(value: unknown): DwaionGovernedCommand {
  const command = record(value, 'command');
  if (!UUID.test(text(command.commandId, 'command.commandId'))) invalid('command.commandId');
  enumValue(command.kind, DWAION_GOVERNED_COMMAND_KINDS, 'command.kind');
  const state = enumValue(command.state, COMMAND_STATES, 'command.state');
  const target = record(command.target, 'command.target');
  text(target.type, 'command.target.type');
  text(target.id, 'command.target.id');
  nonNegativeInteger(command.expectedVersion, 'command.expectedVersion');
  optionalText(command.makerUserId, 'command.makerUserId');
  optionalText(command.checkerUserId, 'command.checkerUserId');
  if (command.makerUserId != null && command.checkerUserId === command.makerUserId) {
    invalid('command.checkerUserId');
  }
  boolean(command.approvalRequired, 'command.approvalRequired');
  const canApprove = boolean(command.canApprove, 'command.canApprove');
  validateCommandReview(command.review, 'command.review');
  const transitions = stringArray(command.allowedTransitions, 'command.allowedTransitions');
  uniqueStrings(transitions, 'command.allowedTransitions');
  transitions.forEach((transition) =>
    enumValue(transition, COMMAND_TRANSITIONS, 'command.allowedTransitions')
  );
  const allowedByState: Record<string, Set<string>> = {
    AWAITING_APPROVAL: new Set(['APPROVE', 'REJECT', 'CANCEL']),
    QUEUED: new Set(['CANCEL']),
    RUNNING: new Set(['CANCEL']),
    PARTIAL: new Set(['RETRY', 'ROLLBACK']),
    SUCCEEDED: new Set(['ROLLBACK']),
    FAILED: new Set(['RETRY', 'ROLLBACK']),
    REJECTED: new Set(),
    CANCELLED: new Set(),
    ROLLED_BACK: new Set(),
  };
  if (transitions.some((transition) => !allowedByState[state]?.has(transition))) {
    invalid('command.allowedTransitions.state');
  }
  if (canApprove !== (state === 'AWAITING_APPROVAL' && transitions.includes('APPROVE'))) {
    invalid('command.canApprove');
  }
  optionalText(command.transitionBlockReason, 'command.transitionBlockReason');
  optionalPercentage(command.progressPercent, 'command.progressPercent');
  timestamp(command.createdAt, 'command.createdAt');
  timestamp(command.updatedAt, 'command.updatedAt');
  positiveInteger(command.version, 'command.version');
  if (command.problem != null) {
    const problem = record(command.problem, 'command.problem');
    text(problem.code, 'command.problem.code');
    text(problem.detail, 'command.problem.detail');
    optionalText(problem.recoveryHint, 'command.problem.recoveryHint');
  }
  if (command.receipt != null) {
    const receipt = record(command.receipt, 'command.receipt');
    text(receipt.receiptId, 'command.receipt.receiptId');
    text(receipt.auditEventId, 'command.receipt.auditEventId');
    timestamp(receipt.completedAt, 'command.receipt.completedAt');
    text(receipt.resultSummary, 'command.receipt.resultSummary');
    optionalText(receipt.domainReceiptRef, 'command.receipt.domainReceiptRef');
    optionalText(receipt.rollbackRef, 'command.receipt.rollbackRef');
    if (state !== 'SUCCEEDED' && state !== 'ROLLED_BACK') invalid('command.receipt.state');
  }
  if ((state === 'SUCCEEDED' || state === 'ROLLED_BACK') && command.receipt == null) {
    invalid('command.receipt');
  }
  let decision: JsonRecord | null = null;
  if (command.decision != null) {
    decision = record(command.decision, 'command.decision');
    enumValue(decision.decision, new Set(['APPROVE', 'REJECT']), 'command.decision.decision');
    text(decision.actorUserId, 'command.decision.actorUserId');
    text(decision.reason, 'command.decision.reason');
    stringArray(decision.evidenceRefs, 'command.decision.evidenceRefs');
    timestamp(decision.decidedAt, 'command.decision.decidedAt');
    if (command.checkerUserId == null || decision.actorUserId !== command.checkerUserId) {
      invalid('command.decision.actorUserId');
    }
  }
  if (state === 'REJECTED' && decision?.decision !== 'REJECT') invalid('command.decision');
  if (state === 'AWAITING_APPROVAL' && decision != null) invalid('command.decision.state');
  if (decision?.decision === 'REJECT' && state !== 'REJECTED') invalid('command.decision.state');
  return command as DwaionGovernedCommand;
}

export function parseDwaionGovernedCommands(
  value: unknown,
  expectedState?: DwaionGovernedCommandState,
  maxCount?: number
): DwaionGovernedCommandsSnapshot {
  const snapshot = record(value, 'commands');
  timestamp(snapshot.generatedAt, 'commands.generatedAt');
  const commands = array(snapshot.commands, 'commands.items');
  if (maxCount != null && commands.length > maxCount) invalid('commands.items');
  uniqueRecords(commands, 'commandId', 'commands.items');
  commands.forEach((command) => {
    const parsed = parseDwaionGovernedCommand(command);
    if (expectedState && parsed.state !== expectedState) invalid('commands.items.state');
  });
  return snapshot as DwaionGovernedCommandsSnapshot;
}

function validateCommandReview(value: unknown, label: string): void {
  const review = record(value, label);
  text(review.reason, `${label}.reason`);
  text(review.ticketRef, `${label}.ticketRef`);
  const evidenceRefs = stringArray(review.evidenceRefs, `${label}.evidenceRefs`);
  uniqueStrings(evidenceRefs, `${label}.evidenceRefs`);
  const preflight = record(review.preflight, `${label}.preflight`);
  const changes = array(preflight.changes, `${label}.preflight.changes`);
  if (changes.length === 0) invalid(`${label}.preflight.changes`);
  changes.forEach((candidate, index) => {
    const changeLabel = `${label}.preflight.changes[${index}]`;
    const change = record(candidate, changeLabel);
    text(change.field, `${changeLabel}.field`);
    text(change.before, `${changeLabel}.before`, true);
    text(change.after, `${changeLabel}.after`, true);
  });
  const impactScopes = stringArray(preflight.impactScopes, `${label}.preflight.impactScopes`);
  if (impactScopes.length === 0) invalid(`${label}.preflight.impactScopes`);
  uniqueStrings(impactScopes, `${label}.preflight.impactScopes`);
  text(preflight.recoveryPlan, `${label}.preflight.recoveryPlan`);
  if (!SHA_256.test(text(preflight.recoveryPlanHash, `${label}.preflight.recoveryPlanHash`))) {
    invalid(`${label}.preflight.recoveryPlanHash`);
  }
}
