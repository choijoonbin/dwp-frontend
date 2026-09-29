import { Temporal } from 'temporal-polyfill';

export const PERFORMANCE_CYCLE_OPERATIONS_ROUTE = '/hr/operations/talent' as const;

export type PerformanceCycleLifecycle = 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'RETIRED';
export type PerformanceCycleVersionState = 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'SUPERSEDED';
export type PerformanceCycleAllowedAction =
  'VIEW' | 'CREATE_DRAFT' | 'UPDATE_DRAFT' | 'PREVIEW_PARTICIPANTS' | 'PUBLISH';
export type PerformancePopulationPreviewState = 'READY' | 'STALE' | 'RESULT_UNKNOWN';
export type PerformanceCommandReceiptState =
  'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN' | 'QUARANTINED';
export type PerformanceCommandType =
  'CREATE_DRAFT' | 'UPDATE_DRAFT' | 'VALIDATE_DRAFT' | 'PREVIEW_PARTICIPANTS' | 'PUBLISH';
export type PerformanceOriginatingAction =
  | 'performance.cycle.create'
  | 'performance.cycle.update'
  | 'performance.cycle.validate'
  | 'performance.cycle.preview'
  | 'performance.cycle.publish';

export type PerformanceCycleStage = Readonly<{
  stageId: string;
  stageKey: string;
  stageType: string;
  sequenceNo: number;
  opensAt: string;
  closesAt: string;
  required: boolean;
  stageConfig: Readonly<Record<string, unknown>>;
}>;

export type PerformanceCycleVersion = Readonly<{
  cycleVersionId: string;
  versionNo: number;
  versionState: PerformanceCycleVersionState;
  aggregateVersion: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  timezoneId: string;
  policyVersionId: string;
  populationRuleVersionId: string | null;
  contentHash: string;
  authoredBy: number;
  publishedAt: string | null;
  publishedBy: number | null;
  stages: readonly PerformanceCycleStage[];
}>;

export type PerformanceCycleSummary = Readonly<{
  cycleId: string;
  cycleKey: string;
  displayName: string;
  lifecycleState: PerformanceCycleLifecycle;
  activeVersionNo: number | null;
  aggregateVersion: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  allowedActions: readonly PerformanceCycleAllowedAction[];
}>;

export type PerformanceCycleDetail = PerformanceCycleSummary &
  Readonly<{
    retentionPolicyId: string;
    createdAt: string;
    createdBy: number;
    updatedAt: string;
    updatedBy: number;
    version: PerformanceCycleVersion;
  }>;

export type PerformanceCycleCollection = Readonly<{
  cycles: readonly PerformanceCycleSummary[];
  allowedActions: readonly PerformanceCycleAllowedAction[];
}>;

export type PerformancePopulationPreviewMember = Readonly<{
  participantRef: string;
  primaryAssignmentRef: string;
  workforceStatus: string;
  organizationRef: string;
  reviewerAssignmentRef: string | null;
  jobProfileRef: string | null;
  gradeRef: string | null;
  eligibilityCode: 'INCLUDED' | 'EXCLUDED' | 'REVIEW_REQUIRED';
}>;

export type PerformancePopulationPreview = Readonly<{
  populationPreviewId: string;
  cycleVersionId: string;
  workforceSnapshotId: string;
  workforceSnapshotRevision: number;
  populationRuleVersionId: string;
  state: PerformancePopulationPreviewState;
  participantCount: number;
  reviewerAssignmentCount: number;
  contentHash: string;
  aggregateVersion: number;
  sourceCycleAggregateVersion: number;
  createdAt: string;
  expiresAt: string | null;
  members: readonly PerformancePopulationPreviewMember[];
}>;

export type PerformanceCommandReceipt = Readonly<{
  receiptId: string;
  commandType: PerformanceCommandType;
  originatingAction: PerformanceOriginatingAction;
  aggregateId: string;
  expectedAggregateVersion: number;
  appliedAggregateVersion: number | null;
  state: PerformanceCommandReceiptState;
  resultRef: string | null;
  errorCode: string | null;
  acceptedAt: string;
  completedAt: string | null;
}>;

export type PerformanceCycleCommandResult = Readonly<{
  cycle: PerformanceCycleDetail | null;
  receipt: PerformanceCommandReceipt;
}>;

export type PerformancePreviewCommandResult = Readonly<{
  preview: PerformancePopulationPreview | null;
  receipt: PerformanceCommandReceipt;
}>;

const CYCLE_STATES = new Set<PerformanceCycleLifecycle>([
  'DRAFT',
  'VALIDATED',
  'PUBLISHED',
  'RETIRED',
]);
const VERSION_STATES = new Set<PerformanceCycleVersionState>([
  'DRAFT',
  'VALIDATED',
  'PUBLISHED',
  'SUPERSEDED',
]);
const ALLOWED_ACTIONS = new Set<PerformanceCycleAllowedAction>([
  'VIEW',
  'CREATE_DRAFT',
  'UPDATE_DRAFT',
  'PREVIEW_PARTICIPANTS',
  'PUBLISH',
]);
const PREVIEW_STATES = new Set<PerformancePopulationPreviewState>([
  'READY',
  'STALE',
  'RESULT_UNKNOWN',
]);
const RECEIPT_STATES = new Set<PerformanceCommandReceiptState>([
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
  'QUARANTINED',
]);
const COMMAND_TYPES = new Set<PerformanceCommandType>([
  'CREATE_DRAFT',
  'UPDATE_DRAFT',
  'VALIDATE_DRAFT',
  'PREVIEW_PARTICIPANTS',
  'PUBLISH',
]);
const ORIGINATING_ACTIONS = new Set<PerformanceOriginatingAction>([
  'performance.cycle.create',
  'performance.cycle.update',
  'performance.cycle.validate',
  'performance.cycle.preview',
  'performance.cycle.publish',
]);
const COMMAND_ACTION: Record<PerformanceCommandType, PerformanceOriginatingAction> = {
  CREATE_DRAFT: 'performance.cycle.create',
  UPDATE_DRAFT: 'performance.cycle.update',
  VALIDATE_DRAFT: 'performance.cycle.validate',
  PREVIEW_PARTICIPANTS: 'performance.cycle.preview',
  PUBLISH: 'performance.cycle.publish',
};
const WORKFORCE_STATES = new Set(['PENDING', 'ACTIVE', 'INACTIVE', 'TERMINATED'] as const);
const ELIGIBILITY_CODES = new Set<PerformancePopulationPreviewMember['eligibilityCode']>([
  'INCLUDED',
  'EXCLUDED',
  'REVIEW_REQUIRED',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_256 = /^[0-9a-f]{64}$/;

function invalidSource(): never {
  throw new Error('Performance cycle source payload is invalid.');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidSource();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalidSource();
  return value as Record<string, unknown>;
}

function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) return invalidSource();
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return invalidSource();
  }
  return value;
}

function hasControl(value: string): boolean {
  return [...value].some((character) => {
    const point = character.codePointAt(0);
    return point !== undefined && (point <= 0x1f || point === 0x7f);
  });
}

function text(value: unknown, maximum: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    hasControl(value)
  ) {
    return invalidSource();
  }
  return value;
}

function nullableText(value: unknown, maximum: number): string | null {
  return value === null ? null : text(value, maximum);
}

function uuid(value: unknown): string {
  const candidate = text(value, 36);
  return UUID.test(candidate) ? candidate : invalidSource();
}

function nullableUuid(value: unknown): string | null {
  return value === null ? null : uuid(value);
}

function sha256(value: unknown): string {
  const candidate = text(value, 64);
  return SHA_256.test(candidate) ? candidate : invalidSource();
}

function integer(value: unknown, minimum = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
    ? value
    : invalidSource();
}

function nullableInteger(value: unknown, minimum = 0): number | null {
  return value === null ? null : integer(value, minimum);
}

function instant(value: unknown): string {
  const candidate = text(value, 100);
  try {
    Temporal.Instant.from(candidate);
    return candidate;
  } catch {
    return invalidSource();
  }
}

function nullableInstant(value: unknown): string | null {
  return value === null ? null : instant(value);
}

function enumeration<T extends string>(value: unknown, values: ReadonlySet<T>): T {
  const candidate = text(value, 100) as T;
  return values.has(candidate) ? candidate : invalidSource();
}

function sourceBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalidSource();
}

function jsonValue(value: unknown, depth = 0): unknown {
  if (depth > 10) return invalidSource();
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : invalidSource();
  if (Array.isArray(value)) return Object.freeze(value.map((item) => jsonValue(item, depth + 1)));
  const source = record(value);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(source).map(([key, child]) => [text(key, 200), jsonValue(child, depth + 1)])
    )
  );
}

function jsonObject(value: unknown): Readonly<Record<string, unknown>> {
  return jsonValue(record(value)) as Readonly<Record<string, unknown>>;
}

function actions(value: unknown): readonly PerformanceCycleAllowedAction[] {
  const selected = array(value).map((item) => enumeration(item, ALLOWED_ACTIONS));
  return new Set(selected).size === selected.length ? Object.freeze(selected) : invalidSource();
}

function selectSummary(source: unknown): PerformanceCycleSummary {
  const item = record(source);
  const effectiveFrom = instant(item.effectiveFrom);
  const effectiveTo = nullableInstant(item.effectiveTo);
  if (effectiveTo && Temporal.Instant.compare(effectiveFrom, effectiveTo) >= 0)
    return invalidSource();
  return Object.freeze({
    cycleId: uuid(item.cycleId),
    cycleKey: text(item.cycleKey, 100),
    displayName: text(item.displayName, 240),
    lifecycleState: enumeration(item.lifecycleState, CYCLE_STATES),
    activeVersionNo: nullableInteger(item.activeVersionNo, 1),
    aggregateVersion: integer(item.aggregateVersion),
    effectiveFrom,
    effectiveTo,
    allowedActions: actions(item.allowedActions),
  });
}

function selectStage(source: unknown): PerformanceCycleStage {
  const stage = record(source);
  const opensAt = instant(stage.opensAt);
  const closesAt = instant(stage.closesAt);
  if (Temporal.Instant.compare(opensAt, closesAt) >= 0) return invalidSource();
  return Object.freeze({
    stageId: uuid(stage.stageId),
    stageKey: text(stage.stageKey, 80),
    stageType: text(stage.stageType, 32),
    sequenceNo: integer(stage.sequenceNo, 1),
    opensAt,
    closesAt,
    required: sourceBoolean(stage.required),
    stageConfig: jsonObject(stage.stageConfig),
  });
}

function selectVersion(source: unknown): PerformanceCycleVersion {
  const version = record(source);
  const effectiveFrom = instant(version.effectiveFrom);
  const effectiveTo = nullableInstant(version.effectiveTo);
  const stages = array(version.stages).map(selectStage);
  const versionState = enumeration(version.versionState, VERSION_STATES);
  const authoredBy = integer(version.authoredBy, 1);
  const publishedAt = nullableInstant(version.publishedAt);
  const publishedBy = nullableInteger(version.publishedBy, 1);
  const isPublished = versionState === 'PUBLISHED' || versionState === 'SUPERSEDED';
  if (
    (effectiveTo && Temporal.Instant.compare(effectiveFrom, effectiveTo) >= 0) ||
    new Set(stages.map((stage) => stage.stageId)).size !== stages.length ||
    new Set(stages.map((stage) => stage.stageKey)).size !== stages.length ||
    stages.some((stage, index) => stage.sequenceNo !== index + 1) ||
    stages.some(
      (stage) =>
        Temporal.Instant.compare(stage.opensAt, effectiveFrom) < 0 ||
        (effectiveTo && Temporal.Instant.compare(stage.closesAt, effectiveTo) > 0)
    ) ||
    isPublished !== (publishedAt !== null && publishedBy !== null) ||
    (publishedBy !== null && publishedBy === authoredBy)
  ) {
    return invalidSource();
  }
  return Object.freeze({
    cycleVersionId: uuid(version.cycleVersionId),
    versionNo: integer(version.versionNo, 1),
    versionState,
    aggregateVersion: integer(version.aggregateVersion),
    effectiveFrom,
    effectiveTo,
    timezoneId: text(version.timezoneId, 80),
    policyVersionId: uuid(version.policyVersionId),
    populationRuleVersionId: nullableUuid(version.populationRuleVersionId),
    contentHash: sha256(version.contentHash),
    authoredBy,
    publishedAt,
    publishedBy,
    stages: Object.freeze(stages),
  });
}

export function selectPerformanceCycleCollection(source: unknown): PerformanceCycleCollection {
  const collection = record(source);
  const cycles = array(collection.cycles).map(selectSummary);
  if (
    new Set(cycles.map((cycle) => cycle.cycleId)).size !== cycles.length ||
    new Set(cycles.map((cycle) => cycle.cycleKey)).size !== cycles.length
  ) {
    return invalidSource();
  }
  return Object.freeze({
    cycles: Object.freeze(cycles),
    allowedActions: actions(collection.allowedActions),
  });
}

export function selectPerformanceCycleDetail(source: unknown): PerformanceCycleDetail {
  const item = record(source);
  const summary = selectSummary(item);
  const version = selectVersion(item.version);
  if (
    summary.activeVersionNo !== version.versionNo ||
    summary.effectiveFrom !== version.effectiveFrom ||
    summary.effectiveTo !== version.effectiveTo ||
    (summary.lifecycleState !== 'RETIRED' && summary.lifecycleState !== version.versionState)
  ) {
    return invalidSource();
  }
  return Object.freeze({
    ...summary,
    retentionPolicyId: uuid(item.retentionPolicyId),
    createdAt: instant(item.createdAt),
    createdBy: integer(item.createdBy, 1),
    updatedAt: instant(item.updatedAt),
    updatedBy: integer(item.updatedBy, 1),
    version,
  });
}

function selectMember(source: unknown): PerformancePopulationPreviewMember {
  const member = record(source);
  return Object.freeze({
    participantRef: uuid(member.participantRef),
    primaryAssignmentRef: uuid(member.primaryAssignmentRef),
    workforceStatus: enumeration(member.workforceStatus, WORKFORCE_STATES),
    organizationRef: uuid(member.organizationRef),
    reviewerAssignmentRef: nullableUuid(member.reviewerAssignmentRef),
    jobProfileRef: nullableUuid(member.jobProfileRef),
    gradeRef: nullableUuid(member.gradeRef),
    eligibilityCode: enumeration(member.eligibilityCode, ELIGIBILITY_CODES),
  });
}

export function selectPerformancePopulationPreview(source: unknown): PerformancePopulationPreview {
  const item = record(source);
  const members = array(item.members).map(selectMember);
  const participantCount = integer(item.participantCount);
  const createdAt = instant(item.createdAt);
  const expiresAt = nullableInstant(item.expiresAt);
  const eligibleMembers = members.filter((member) => member.eligibilityCode !== 'EXCLUDED');
  const distinctReviewers = new Set(
    eligibleMembers.flatMap((member) =>
      member.reviewerAssignmentRef ? [member.reviewerAssignmentRef] : []
    )
  );
  if (
    new Set(members.map((member) => `${member.participantRef}:${member.primaryAssignmentRef}`))
      .size !== members.length ||
    participantCount !== eligibleMembers.length ||
    integer(item.reviewerAssignmentCount) !== distinctReviewers.size ||
    (expiresAt !== null && Temporal.Instant.compare(createdAt, expiresAt) >= 0)
  ) {
    return invalidSource();
  }
  return Object.freeze({
    populationPreviewId: uuid(item.populationPreviewId),
    cycleVersionId: uuid(item.cycleVersionId),
    workforceSnapshotId: uuid(item.workforceSnapshotId),
    workforceSnapshotRevision: integer(item.workforceSnapshotRevision, 1),
    populationRuleVersionId: uuid(item.populationRuleVersionId),
    state: enumeration(item.state, PREVIEW_STATES),
    participantCount,
    reviewerAssignmentCount: distinctReviewers.size,
    contentHash: sha256(item.contentHash),
    aggregateVersion: integer(item.aggregateVersion),
    sourceCycleAggregateVersion: integer(item.sourceCycleAggregateVersion),
    createdAt,
    expiresAt,
    members: Object.freeze(members),
  });
}

export function selectPerformanceCommandReceipt(source: unknown): PerformanceCommandReceipt {
  const item = record(source);
  const state = enumeration(item.state, RECEIPT_STATES);
  const commandType = enumeration(item.commandType, COMMAND_TYPES);
  const originatingAction = enumeration(item.originatingAction, ORIGINATING_ACTIONS);
  const resultRef = nullableUuid(item.resultRef);
  const appliedAggregateVersion = nullableInteger(item.appliedAggregateVersion);
  const errorCode = nullableText(item.errorCode, 200);
  const completedAt = nullableInstant(item.completedAt);
  const terminal = state === 'SUCCEEDED' || state === 'FAILED' || state === 'QUARANTINED';
  if (
    terminal !== (completedAt !== null) ||
    (state === 'SUCCEEDED' &&
      (resultRef === null || appliedAggregateVersion === null || errorCode !== null)) ||
    ((state === 'FAILED' || state === 'QUARANTINED') && errorCode === null) ||
    COMMAND_ACTION[commandType] !== originatingAction
  ) {
    return invalidSource();
  }
  return Object.freeze({
    receiptId: uuid(item.receiptId),
    commandType,
    originatingAction,
    aggregateId: uuid(item.aggregateId),
    expectedAggregateVersion: integer(item.expectedAggregateVersion),
    appliedAggregateVersion,
    state,
    resultRef,
    errorCode,
    acceptedAt: instant(item.acceptedAt),
    completedAt,
  });
}

export function selectPerformanceCycleCommandResult(
  source: unknown
): PerformanceCycleCommandResult {
  const item = record(source);
  const receipt = selectPerformanceCommandReceipt(item.receipt);
  const cycle = item.cycle === null ? null : selectPerformanceCycleDetail(item.cycle);
  if (
    receipt.commandType === 'PREVIEW_PARTICIPANTS' ||
    (cycle === null && receipt.state === 'SUCCEEDED') ||
    (cycle !== null &&
      (receipt.aggregateId !== cycle.cycleId ||
        (receipt.resultRef !== null && receipt.resultRef !== cycle.cycleId) ||
        (receipt.appliedAggregateVersion !== null &&
          cycle.aggregateVersion < receipt.appliedAggregateVersion))) ||
    (receipt.state === 'SUCCEEDED' && receipt.resultRef !== cycle?.cycleId)
  ) {
    return invalidSource();
  }
  return Object.freeze({ cycle, receipt });
}

export function selectPerformancePreviewCommandResult(
  source: unknown
): PerformancePreviewCommandResult {
  const item = record(source);
  const receipt = selectPerformanceCommandReceipt(item.receipt);
  const preview = item.preview === null ? null : selectPerformancePopulationPreview(item.preview);
  if (
    receipt.commandType !== 'PREVIEW_PARTICIPANTS' ||
    (preview === null && receipt.state === 'SUCCEEDED') ||
    (preview !== null &&
      (receipt.resultRef !== preview.populationPreviewId ||
        (receipt.appliedAggregateVersion !== null &&
          preview.aggregateVersion < receipt.appliedAggregateVersion)))
  ) {
    return invalidSource();
  }
  return Object.freeze({
    preview,
    receipt,
  });
}

export function performanceCycleCollectionQueryKey(scope: { cacheKey: readonly string[] }) {
  return ['hris', 'performance', 'cycle-collection-v1', ...scope.cacheKey] as const;
}

export function performanceCycleDetailQueryKey(
  scope: { cacheKey: readonly string[] },
  cycleId: string
) {
  return ['hris', 'performance', 'cycle-detail-v1', cycleId, ...scope.cacheKey] as const;
}

export function performanceReceiptQueryKey(
  scope: { cacheKey: readonly string[] },
  receiptId: string
) {
  return ['hris', 'performance', 'command-receipt-v1', receiptId, ...scope.cacheKey] as const;
}
