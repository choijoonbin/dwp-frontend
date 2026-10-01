export type CompatibilityDecision = 'COMPATIBLE' | 'REVIEW_REQUIRED' | 'BLOCKED';

export type CompatibilityPolicy = {
  schema: { currentVersion: string; targetVersion: string; migrationState: string };
  clients: Array<{ clientType: string; minimumVersion: string }>;
  dependencies: Array<{ dependencyKey: string; requiredVersion: string }>;
  capabilities: { allowAdded: boolean; allowRemoved: boolean; allowIncreased: boolean };
  rollback: { required: boolean; strategy: string };
};

export type CompatibilityEvidence = {
  schema: {
    state: string;
    currentVersion: string;
    targetVersion: string;
    migrationState: string;
  };
  clients: Array<{ clientType: string; minimumVersion: string; state: string }>;
  dependencies: Array<{
    dependencyKey: string;
    requiredVersion: string;
    observedVersion: string;
    state: string;
  }>;
  capabilities: { added: string[]; removed: string[]; increased: string[] };
  rollbackReadiness: { state: string; reasons: string[]; executionBoundary: string };
};

export type RolloutProjection = {
  target: {
    environmentKey: string;
    tenantKeys: string[];
    cohortKeys: string[];
    targetPercentage: number;
  } | null;
  stages: Array<{
    stageKey: string;
    targetPercentage: number;
    minimumObservationMinutes: number;
    approvalGate: boolean;
  }>;
  rollback: {
    strategy: string;
    targetVersion: string;
    dataHandling: string;
    validationChecks: string[];
    manualSteps: string[];
  } | null;
};

export type ArtifactRequirementDraft = { id: string; key: string; version: string };
export type ArtifactPolicyDraft = {
  currentVersion: string;
  targetVersion: string;
  migrationState: string;
  clients: ArtifactRequirementDraft[];
  dependencies: ArtifactRequirementDraft[];
  allowAdded: boolean;
  allowRemoved: boolean;
  allowIncreased: boolean;
  rollbackRequired: boolean;
  rollbackStrategy: string;
};
export type ArtifactStageDraft = {
  id: string;
  stageKey: string;
  targetPercentage: string;
  minimumObservationMinutes: string;
  approvalGate: boolean;
};
export type ArtifactTargetDraft = {
  environmentKey: string;
  tenantKeys: string[];
  cohortKeys: string[];
  targetPercentage: string;
};
export type ArtifactRollbackDraft = {
  strategy: string;
  targetVersion: string;
  dataHandling: string;
  validationChecks: string[];
  manualSteps: string[];
};

export type ArtifactFormIssue =
  | 'MANIFEST_REQUIRED'
  | 'POLICY_REQUIRED'
  | 'POLICY_DUPLICATE'
  | 'COMPATIBILITY_INVALID'
  | 'TARGET_INVALID'
  | 'STAGE_REQUIRED'
  | 'STAGE_INVALID'
  | 'STAGE_INCREASING'
  | 'ROLLBACK_INVALID'
  | 'EVIDENCE_REQUIRED';

export class ArtifactFormError extends Error {
  constructor(readonly issue: ArtifactFormIssue) {
    super(issue);
  }
}

const ENUMS = {
  artifactType: ['WEB_APP', 'SERVICE', 'WORKER', 'SCHEMA', 'CONFIG_BUNDLE'],
  migrationState: ['ADDITIVE_ONLY', 'DUAL_WRITE', 'MANUAL_REVIEW', 'UNAVAILABLE'],
  compatibilityState: ['PASSED', 'REVIEW_REQUIRED', 'BLOCKED', 'UNAVAILABLE'],
  rollbackState: [
    'READY',
    'REVIEW_REQUIRED',
    'BLOCKED',
    'UNAVAILABLE',
    'NOT_EVALUATED',
    'NOT_DECLARED',
    'INTERNALLY_READY',
    'EVIDENCE_REQUIRED',
  ],
  rollbackStrategy: ['TRAFFIC_REVERT', 'CONFIG_REVERT', 'MANUAL_RESTORE', 'UNAVAILABLE'],
  dataHandling: ['PRESERVE_CURRENT_SCHEMA', 'RESTORE_SNAPSHOT', 'MANUAL_RECONCILIATION'],
  reviewDecision: ['APPROVED', 'RETURNED'],
  rolloutDecision: ['APPROVED', 'REJECTED'],
  artifactLifecycle: ['DRAFT', 'REVIEW_REQUIRED', 'APPROVED', 'RETURNED'],
  planLifecycle: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'READY', 'CANCELLED'],
  compatibilityDecision: ['NOT_EVALUATED', 'COMPATIBLE', 'REVIEW_REQUIRED', 'BLOCKED'],
  rollbackFeasibility: ['DECLARED', 'NOT_DECLARED', 'UNAVAILABLE'],
  evidenceType: [
    'COMPATIBILITY',
    'PRE_FLIGHT',
    'OBSERVATION',
    'ROLLBACK_FEASIBILITY',
    'MANUAL_RECEIPT',
  ],
  evidenceState: ['PASSED', 'FAILED', 'INCONCLUSIVE', 'NOT_DISPATCHED'],
  executionBoundary: ['INTERNAL_PLAN_ONLY', 'EXTERNAL_EXECUTOR_UNAVAILABLE'],
} as const;

export type ArtifactEnumKind = keyof typeof ENUMS;

export function artifactEnumPresentation(kind: ArtifactEnumKind, value: string): string {
  return (ENUMS[kind] as readonly string[]).includes(value) ? value : 'UNAVAILABLE_VALUE';
}

export function canReviewArtifact(
  artifact: { createdBy: number },
  operatorId: number | null | undefined,
  canApprove: boolean
): boolean {
  return canApprove && operatorId != null && operatorId !== artifact.createdBy;
}

export function canDecideArtifactPlan(
  plan: { requestedBy: number },
  operatorId: number | null | undefined,
  canApprove: boolean
): boolean {
  return canApprove && operatorId != null && operatorId !== plan.requestedBy;
}

export function buildArtifactManifest(value: {
  entrypoint: string;
  packageReference: string;
  changeSummary: string;
}): Record<string, unknown> {
  if (!value.entrypoint.trim() || !value.changeSummary.trim()) {
    throw new ArtifactFormError('MANIFEST_REQUIRED');
  }
  return {
    entrypoint: value.entrypoint.trim(),
    ...(value.packageReference.trim() ? { packageReference: value.packageReference.trim() } : {}),
    changeSummary: value.changeSummary.trim(),
  };
}

export function buildCompatibilityPolicy(draft: ArtifactPolicyDraft): CompatibilityPolicy {
  if (
    !draft.currentVersion.trim() ||
    !draft.targetVersion.trim() ||
    artifactEnumPresentation('migrationState', draft.migrationState) === 'UNAVAILABLE_VALUE' ||
    artifactEnumPresentation('rollbackStrategy', draft.rollbackStrategy) === 'UNAVAILABLE_VALUE'
  ) {
    throw new ArtifactFormError('POLICY_REQUIRED');
  }
  const clients = requirements(draft.clients, 'client');
  const dependencies = requirements(draft.dependencies, 'dependency');
  return {
    schema: {
      currentVersion: draft.currentVersion.trim(),
      targetVersion: draft.targetVersion.trim(),
      migrationState: draft.migrationState,
    },
    clients: clients.map((item) => ({ clientType: item.key, minimumVersion: item.version })),
    dependencies: dependencies.map((item) => ({
      dependencyKey: item.key,
      requiredVersion: item.version,
    })),
    capabilities: {
      allowAdded: draft.allowAdded,
      allowRemoved: draft.allowRemoved,
      allowIncreased: draft.allowIncreased,
    },
    rollback: { required: draft.rollbackRequired, strategy: draft.rollbackStrategy },
  };
}

export function buildCompatibilityAssessment(
  policy: unknown,
  evidence: CompatibilityEvidence
): { compatibilityState: CompatibilityDecision; evidence: Record<string, unknown> } {
  const compatibilityState = deriveCompatibilityDecision(policy, evidence);
  if (!compatibilityState) throw new ArtifactFormError('COMPATIBILITY_INVALID');
  return { compatibilityState, evidence: evidence as unknown as Record<string, unknown> };
}

export function buildArtifactTarget(draft: ArtifactTargetDraft): Record<string, unknown> {
  const targetPercentage = Number(draft.targetPercentage);
  if (
    !draft.environmentKey.trim() ||
    !Number.isInteger(targetPercentage) ||
    targetPercentage < 1 ||
    targetPercentage > 100
  ) {
    throw new ArtifactFormError('TARGET_INVALID');
  }
  return {
    environmentKey: draft.environmentKey.trim(),
    tenantKeys: cleanStrings(draft.tenantKeys),
    cohortKeys: cleanStrings(draft.cohortKeys),
    targetPercentage,
  };
}

export function buildArtifactStages(drafts: ArtifactStageDraft[]): Record<string, unknown>[] {
  if (!drafts.length || drafts.length > 20) throw new ArtifactFormError('STAGE_REQUIRED');
  let previous = 0;
  const keys = new Set<string>();
  return drafts.map((draft) => {
    const key = draft.stageKey.trim();
    const percentage = Number(draft.targetPercentage);
    const minutes = Number(draft.minimumObservationMinutes);
    if (
      !key ||
      keys.has(key) ||
      !Number.isInteger(percentage) ||
      percentage < 1 ||
      percentage > 100 ||
      !Number.isInteger(minutes) ||
      minutes < 0
    ) {
      throw new ArtifactFormError('STAGE_INVALID');
    }
    if (percentage <= previous) throw new ArtifactFormError('STAGE_INCREASING');
    keys.add(key);
    previous = percentage;
    return {
      stageKey: key,
      targetPercentage: percentage,
      minimumObservationMinutes: minutes,
      approvalGate: draft.approvalGate,
    };
  });
}

export function buildArtifactRollback(draft: ArtifactRollbackDraft): Record<string, unknown> {
  const validationChecks = cleanStrings(draft.validationChecks);
  if (
    artifactEnumPresentation('rollbackStrategy', draft.strategy) === 'UNAVAILABLE_VALUE' ||
    draft.strategy === 'UNAVAILABLE' ||
    artifactEnumPresentation('dataHandling', draft.dataHandling) === 'UNAVAILABLE_VALUE' ||
    !draft.targetVersion.trim() ||
    !validationChecks.length
  ) {
    throw new ArtifactFormError('ROLLBACK_INVALID');
  }
  return {
    strategy: draft.strategy,
    targetVersion: draft.targetVersion.trim(),
    dataHandling: draft.dataHandling,
    validationChecks,
    manualSteps: cleanStrings(draft.manualSteps),
  };
}

export function buildArtifactEvidence(value: {
  sourceReference: string;
  summary: string;
  checks: string[];
}): Record<string, unknown> {
  if (!value.sourceReference.trim() || !value.summary.trim()) {
    throw new ArtifactFormError('EVIDENCE_REQUIRED');
  }
  return {
    sourceReference: value.sourceReference.trim(),
    summary: value.summary.trim(),
    checks: cleanStrings(value.checks),
  };
}

function requirements(
  values: ArtifactRequirementDraft[],
  _kind: 'client' | 'dependency'
): Array<{ key: string; version: string }> {
  const result = values.map((value) => ({
    key: value.key.trim(),
    version: value.version.trim(),
  }));
  if (result.some((value) => !value.key || !value.version)) {
    throw new ArtifactFormError('POLICY_REQUIRED');
  }
  if (new Set(result.map((value) => value.key)).size !== result.length) {
    throw new ArtifactFormError('POLICY_DUPLICATE');
  }
  return result;
}

function cleanStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function strings(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim())
    ? value
    : null;
}

function integer(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

const COMPATIBILITY_STATES = new Set(['PASSED', 'REVIEW_REQUIRED', 'BLOCKED', 'UNAVAILABLE']);
const ROLLBACK_STATES = new Set(['READY', 'REVIEW_REQUIRED', 'BLOCKED', 'UNAVAILABLE']);

export function parseCompatibilityPolicy(value: unknown): CompatibilityPolicy | null {
  const source = record(value);
  const schema = record(source?.schema);
  const capabilities = record(source?.capabilities);
  const rollback = record(source?.rollback);
  if (!source || !schema || !capabilities || !rollback) return null;
  if (!Array.isArray(source.clients) || !Array.isArray(source.dependencies)) return null;
  const clients = source.clients.map(record);
  const dependencies = source.dependencies.map(record);
  if (clients.some((item) => !item) || dependencies.some((item) => !item)) return null;
  const currentVersion = text(schema.currentVersion);
  const targetVersion = text(schema.targetVersion);
  const migrationState = text(schema.migrationState);
  const strategy = text(rollback.strategy);
  if (
    !currentVersion ||
    !targetVersion ||
    !migrationState ||
    !['ADDITIVE_ONLY', 'DUAL_WRITE', 'MANUAL_REVIEW', 'UNAVAILABLE'].includes(migrationState) ||
    typeof capabilities.allowAdded !== 'boolean' ||
    typeof capabilities.allowRemoved !== 'boolean' ||
    typeof capabilities.allowIncreased !== 'boolean' ||
    typeof rollback.required !== 'boolean' ||
    !strategy ||
    !['TRAFFIC_REVERT', 'CONFIG_REVERT', 'MANUAL_RESTORE', 'UNAVAILABLE'].includes(strategy)
  )
    return null;
  const normalizedClients = clients.map((item) => ({
    clientType: text(item!.clientType),
    minimumVersion: text(item!.minimumVersion),
  }));
  const normalizedDependencies = dependencies.map((item) => ({
    dependencyKey: text(item!.dependencyKey),
    requiredVersion: text(item!.requiredVersion),
  }));
  if (
    normalizedClients.some((item) => !item.clientType || !item.minimumVersion) ||
    normalizedDependencies.some((item) => !item.dependencyKey || !item.requiredVersion) ||
    new Set(normalizedClients.map((item) => item.clientType)).size !== normalizedClients.length ||
    new Set(normalizedDependencies.map((item) => item.dependencyKey)).size !==
      normalizedDependencies.length
  )
    return null;
  return {
    schema: { currentVersion, targetVersion, migrationState },
    clients: normalizedClients as CompatibilityPolicy['clients'],
    dependencies: normalizedDependencies as CompatibilityPolicy['dependencies'],
    capabilities: {
      allowAdded: capabilities.allowAdded,
      allowRemoved: capabilities.allowRemoved,
      allowIncreased: capabilities.allowIncreased,
    },
    rollback: { required: rollback.required, strategy },
  };
}

export function compatibilityEvidenceTemplate(policyValue: unknown): CompatibilityEvidence | null {
  const policy = parseCompatibilityPolicy(policyValue);
  if (!policy) return null;
  return {
    schema: { ...policy.schema, state: 'REVIEW_REQUIRED' },
    clients: policy.clients.map((item) => ({ ...item, state: 'REVIEW_REQUIRED' })),
    dependencies: policy.dependencies.map((item) => ({
      ...item,
      observedVersion: '',
      state: 'REVIEW_REQUIRED',
    })),
    capabilities: { added: [], removed: [], increased: [] },
    rollbackReadiness: {
      state: policy.rollback.required ? 'REVIEW_REQUIRED' : 'UNAVAILABLE',
      reasons: policy.rollback.required ? ['ROLLBACK_EVIDENCE_REQUIRED'] : [],
      executionBoundary: 'INTERNAL_PLAN_ONLY',
    },
  };
}

export function deriveCompatibilityDecision(
  policyValue: unknown,
  evidenceValue: unknown
): CompatibilityDecision | null {
  const policy = parseCompatibilityPolicy(policyValue);
  const evidence = record(evidenceValue);
  const schema = record(evidence?.schema);
  const rollback = record(evidence?.rollbackReadiness);
  const capabilities = record(evidence?.capabilities);
  if (
    !policy ||
    !evidence ||
    !schema ||
    !rollback ||
    !capabilities ||
    !Array.isArray(evidence.clients) ||
    !Array.isArray(evidence.dependencies)
  )
    return null;
  const clientRows = evidence.clients.map(record);
  const dependencyRows = evidence.dependencies.map(record);
  if (clientRows.some((item) => !item) || dependencyRows.some((item) => !item)) return null;
  const schemaState = text(schema.state);
  const schemaCurrentVersion = text(schema.currentVersion);
  const schemaTargetVersion = text(schema.targetVersion);
  const schemaMigrationState = text(schema.migrationState);
  const rollbackState = text(rollback.state);
  const rollbackReasons = strings(rollback.reasons);
  const rollbackBoundary = text(rollback.executionBoundary);
  if (
    !schemaState ||
    !COMPATIBILITY_STATES.has(schemaState) ||
    !schemaCurrentVersion ||
    !schemaTargetVersion ||
    !schemaMigrationState ||
    !rollbackState ||
    !ROLLBACK_STATES.has(rollbackState) ||
    !rollbackReasons ||
    rollbackBoundary !== 'INTERNAL_PLAN_ONLY' ||
    schemaCurrentVersion !== policy.schema.currentVersion ||
    schemaTargetVersion !== policy.schema.targetVersion ||
    schemaMigrationState !== policy.schema.migrationState ||
    (schemaMigrationState === 'UNAVAILABLE' && schemaState === 'PASSED') ||
    (policy.rollback.strategy === 'UNAVAILABLE' && rollbackState === 'READY')
  )
    return null;
  const clients = clientRows.flatMap((item) => {
    const clientType = text(item?.clientType);
    const minimumVersion = text(item?.minimumVersion);
    const state = text(item?.state);
    return clientType && minimumVersion && state && COMPATIBILITY_STATES.has(state)
      ? [{ clientType, minimumVersion, state }]
      : [];
  });
  const dependencies = dependencyRows.flatMap((item) => {
    const dependencyKey = text(item?.dependencyKey);
    const requiredVersion = text(item?.requiredVersion);
    const observedVersion = text(item?.observedVersion);
    const state = text(item?.state);
    return dependencyKey &&
      requiredVersion &&
      observedVersion &&
      state &&
      COMPATIBILITY_STATES.has(state)
      ? [{ dependencyKey, requiredVersion, observedVersion, state }]
      : [];
  });
  const clientsByType = new Map(clients.map((item) => [item.clientType, item]));
  const dependenciesByKey = new Map(dependencies.map((item) => [item.dependencyKey, item]));
  if (
    clients.length !== clientRows.length ||
    dependencies.length !== dependencyRows.length ||
    clients.length !== policy.clients.length ||
    dependencies.length !== policy.dependencies.length ||
    clientsByType.size !== policy.clients.length ||
    dependenciesByKey.size !== policy.dependencies.length ||
    policy.clients.some(
      (requirement) =>
        clientsByType.get(requirement.clientType)?.minimumVersion !== requirement.minimumVersion
    ) ||
    policy.dependencies.some(
      (requirement) =>
        dependenciesByKey.get(requirement.dependencyKey)?.requiredVersion !==
        requirement.requiredVersion
    )
  )
    return null;
  const states = [
    schemaState,
    ...clients.map((item) => item.state),
    ...dependencies.map((item) => item.state),
    rollbackState,
  ];
  const added = strings(capabilities.added);
  const removed = strings(capabilities.removed);
  const increased = strings(capabilities.increased);
  if (!added || !removed || !increased) return null;
  const blockedCapability =
    (!policy.capabilities.allowAdded && added.length > 0) ||
    (!policy.capabilities.allowRemoved && removed.length > 0) ||
    (!policy.capabilities.allowIncreased && increased.length > 0);
  const missingRollback = policy.rollback.required && rollbackState !== 'READY';
  if (blockedCapability || missingRollback || states.includes('BLOCKED')) return 'BLOCKED';
  if (states.some((state) => state !== 'PASSED' && state !== 'READY')) return 'REVIEW_REQUIRED';
  return 'COMPATIBLE';
}

export function parseRolloutProjection(
  targetValue: unknown,
  stagesValue: unknown,
  rollbackValue: unknown
): RolloutProjection {
  const targetSource = record(targetValue);
  const tenantKeys = strings(targetSource?.tenantKeys);
  const cohortKeys = strings(targetSource?.cohortKeys);
  const targetPercentage = integer(targetSource?.targetPercentage);
  const environmentKey = text(targetSource?.environmentKey);
  const target =
    environmentKey && tenantKeys && cohortKeys && targetPercentage !== null
      ? { environmentKey, tenantKeys, cohortKeys, targetPercentage }
      : null;
  const stages = Array.isArray(stagesValue)
    ? stagesValue.flatMap((value) => {
        const item = record(value);
        const stageKey = text(item?.stageKey);
        const percentage = integer(item?.targetPercentage);
        const observation = integer(item?.minimumObservationMinutes);
        return stageKey &&
          percentage !== null &&
          observation !== null &&
          typeof item?.approvalGate === 'boolean'
          ? [
              {
                stageKey,
                targetPercentage: percentage,
                minimumObservationMinutes: observation,
                approvalGate: item.approvalGate,
              },
            ]
          : [];
      })
    : [];
  const rollbackSource = record(rollbackValue);
  const strategy = text(rollbackSource?.strategy);
  const targetVersion = text(rollbackSource?.targetVersion);
  const dataHandling = text(rollbackSource?.dataHandling);
  const validationChecks = strings(rollbackSource?.validationChecks);
  const manualSteps = strings(rollbackSource?.manualSteps);
  const rollback =
    strategy && targetVersion && dataHandling && validationChecks && manualSteps
      ? { strategy, targetVersion, dataHandling, validationChecks, manualSteps }
      : null;
  return { target, stages, rollback };
}
