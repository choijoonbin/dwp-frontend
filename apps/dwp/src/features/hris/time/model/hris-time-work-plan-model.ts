import { Temporal } from 'temporal-polyfill';

export const WORK_ARRANGEMENT_KINDS = [
  'FIXED',
  'FLEX',
  'AVERAGED',
  'SELECTIVE',
  'COMPRESSED',
  'PART_TIME',
  'REDUCED',
  'SPLIT_SHIFT',
  'SHIFT',
  'ON_CALL',
  'DEEMED',
  'DISCRETIONARY',
  'TENANT_EXTENSION',
] as const;

export type WorkArrangementKind = (typeof WORK_ARRANGEMENT_KINDS)[number];
export type WorkPlanLifecycle =
  'DRAFT' | 'VALIDATED' | 'SIMULATED' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED';
export type WorkPlanQueryState = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
export type WorkPlanFreshness = 'CURRENT' | 'STALE' | 'UNAVAILABLE';
export type PolicyPackState =
  | 'CURRENT'
  | 'MISSING'
  | 'EXPIRED'
  | 'OUT_OF_RANGE'
  | 'STALE'
  | 'REVOKED'
  | 'INVALID'
  | 'SIGNATURE_INVALID';
export type PolicyResolutionState =
  | 'RESOLVED'
  | 'NO_APPLICABLE_POLICY'
  | 'OVERLAP'
  | 'PACK_MISSING'
  | 'PACK_EXPIRED'
  | 'OUT_OF_RANGE'
  | 'STALE'
  | 'REVOKED'
  | 'INVALID'
  | 'SIGNATURE_INVALID';
export type PolicyPrecedenceLevel =
  | 'JURISDICTION'
  | 'LEGAL_ENTITY'
  | 'COLLECTIVE_AGREEMENT'
  | 'LOCATION'
  | 'JOB'
  | 'EMPLOYMENT'
  | 'WORKER'
  | 'ASSIGNMENT';
export type WorkPlanAction = 'VALIDATE' | 'SIMULATE';
export type ReceiptStatus =
  'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'RESULT_UNKNOWN' | 'RECONCILING';

export type PolicyTraceStep = Readonly<{
  level: PolicyPrecedenceLevel;
  label: string;
  disposition: 'APPLIED' | 'SHADOWED' | 'NOT_APPLICABLE';
  policyCode?: string;
  policyRevision?: string;
}>;

export type ScheduleSegmentDisplay = Readonly<{
  segmentId: string;
  label: string;
  startInstant: string;
  endInstant: string;
  localStart: string;
  localEnd: string;
  startOffset: string;
  endOffset: string;
  overnight: boolean;
  dstResolution: 'EXACT' | 'GAP_REJECTED' | 'FOLD_EARLIER' | 'FOLD_LATER';
}>;

export type WorkPlanDisplay = Readonly<{
  workPlanId: string;
  title: string;
  version: number;
  lifecycle: WorkPlanLifecycle;
  arrangement: Readonly<{ kind: WorkArrangementKind; extensionCode?: string }>;
  effectiveStart: string;
  effectiveEnd?: string;
  timeZone: string;
  assignment: Readonly<{
    assignmentId: string;
    label: string;
    snapshotRevision: string;
    freshness: 'CURRENT' | 'STALE';
  }>;
  policyPack: Readonly<{
    state: PolicyPackState;
    jurisdiction: string;
    effectiveOn: string;
    revision?: string;
  }>;
  resolution: Readonly<{
    state: PolicyResolutionState;
    winningLevel?: PolicyPrecedenceLevel;
    trace: readonly PolicyTraceStep[];
  }>;
  segments: readonly ScheduleSegmentDisplay[];
  availableActions: readonly WorkPlanAction[];
}>;

export type WorkPlanSimulation = Readonly<{
  workPlanId: string;
  baseVersion: number;
  status: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' | 'STALE';
  generatedAt: string;
  policyRevision: string;
  rows: readonly Readonly<{
    key: string;
    label: string;
    currentValue: string;
    draftValue: string;
    impact: 'INFO' | 'WARNING' | 'BLOCKING';
  }>[];
  findings: readonly string[];
  partialFailures: readonly string[];
}>;

export type WorkPlanReceipt = Readonly<{
  receiptId: string;
  workPlanId: string;
  operation: 'SIMULATE';
  idempotencyKey: string;
  status: ReceiptStatus;
  updatedAt: string;
}>;

export type WorkPlanSimulationCommand = Readonly<{
  receipt: WorkPlanReceipt;
  simulation: WorkPlanSimulation | null;
}>;

export type WorkPlanStudioDisplay = Readonly<{
  queryState: WorkPlanQueryState;
  freshness: WorkPlanFreshness;
  asOf: string;
  partialFailures: readonly string[];
  workPlans: readonly WorkPlanDisplay[];
}>;

export type WorkPlanSimulationRequest = Readonly<{
  workPlanId: string;
  expectedVersion: number;
  assignmentSnapshotRevision: string;
  policyRevision: string;
  purpose: 'PRE_PUBLISH_IMPACT_REVIEW';
}>;

const ARRANGEMENT_KINDS = new Set<string>(WORK_ARRANGEMENT_KINDS);
const LIFECYCLES = new Set<string>([
  'DRAFT',
  'VALIDATED',
  'SIMULATED',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
]);
const QUERY_STATES = new Set<string>(['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE']);
const FRESHNESS = new Set<string>(['CURRENT', 'STALE', 'UNAVAILABLE']);
const PACK_STATES = new Set<string>([
  'CURRENT',
  'MISSING',
  'EXPIRED',
  'OUT_OF_RANGE',
  'STALE',
  'REVOKED',
  'INVALID',
  'SIGNATURE_INVALID',
]);
const RESOLUTION_STATES = new Set<string>([
  'RESOLVED',
  'NO_APPLICABLE_POLICY',
  'OVERLAP',
  'PACK_MISSING',
  'PACK_EXPIRED',
  'OUT_OF_RANGE',
  'STALE',
  'REVOKED',
  'INVALID',
  'SIGNATURE_INVALID',
]);
const PRECEDENCE_LEVELS = new Set<string>([
  'JURISDICTION',
  'LEGAL_ENTITY',
  'COLLECTIVE_AGREEMENT',
  'LOCATION',
  'JOB',
  'EMPLOYMENT',
  'WORKER',
  'ASSIGNMENT',
]);
const TRACE_DISPOSITIONS = new Set<string>(['APPLIED', 'SHADOWED', 'NOT_APPLICABLE']);
const ACTIONS = new Set<string>(['VALIDATE', 'SIMULATE']);
const DST_RESOLUTIONS = new Set<string>(['EXACT', 'GAP_REJECTED', 'FOLD_EARLIER', 'FOLD_LATER']);
const RECEIPT_STATUSES = new Set<string>([
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'RESULT_UNKNOWN',
  'RECONCILING',
]);
const SIMULATION_STATUSES = new Set<string>(['COMPLETE', 'PARTIAL', 'UNAVAILABLE', 'STALE']);
const IMPACTS = new Set<string>(['INFO', 'WARNING', 'BLOCKING']);

function invalidSource(): never {
  throw new Error('Work plan studio source payload is invalid.');
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

function text(value: unknown, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) return invalidSource();
  if ([...value].some((character) => (character.codePointAt(0) ?? 0) < 32)) return invalidSource();
  return value;
}

function optionalText(value: unknown, maximum = 500): string | undefined {
  return value === undefined || value === null ? undefined : text(value, maximum);
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    return invalidSource();
  return value;
}

function positiveInteger(value: unknown): number {
  const candidate = integer(value);
  return candidate > 0 ? candidate : invalidSource();
}

function boolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalidSource();
}

function enumValue<T extends string>(value: unknown, values: ReadonlySet<string>): T {
  const candidate = text(value, 100);
  return values.has(candidate) ? (candidate as T) : invalidSource();
}

function civilDate(value: unknown): string {
  const candidate = text(value, 10);
  try {
    return Temporal.PlainDate.from(candidate).toString() === candidate
      ? candidate
      : invalidSource();
  } catch {
    return invalidSource();
  }
}

function instant(value: unknown): string {
  const candidate = text(value, 80);
  try {
    Temporal.Instant.from(candidate);
    return candidate;
  } catch {
    return invalidSource();
  }
}

function unique<T>(values: readonly T[], key: (value: T) => string): readonly T[] {
  const keys = new Set<string>();
  for (const value of values) {
    const candidate = key(value);
    if (keys.has(candidate)) return invalidSource();
    keys.add(candidate);
  }
  return values;
}

function localStamp(value: Temporal.ZonedDateTime): string {
  const hour = String(value.hour).padStart(2, '0');
  const minute = String(value.minute).padStart(2, '0');
  return `${value.toPlainDate().toString()} ${hour}:${minute}`;
}

export function isValidScheduleTimeZone(timeZone: string): boolean {
  try {
    if (/^[+-]/.test(timeZone)) return false;
    Temporal.Instant.from('2000-01-01T00:00:00Z').toZonedDateTimeISO(timeZone);
    return true;
  } catch {
    return false;
  }
}

function selectTraceStep(source: unknown): PolicyTraceStep {
  const value = record(source);
  const policyCode = optionalText(value.policyCode, 120);
  const policyRevision = optionalText(value.policyRevision, 120);
  return Object.freeze({
    level: enumValue<PolicyPrecedenceLevel>(value.level, PRECEDENCE_LEVELS),
    label: text(value.label),
    disposition: enumValue<'APPLIED' | 'SHADOWED' | 'NOT_APPLICABLE'>(
      value.disposition,
      TRACE_DISPOSITIONS
    ),
    ...(policyCode ? { policyCode } : {}),
    ...(policyRevision ? { policyRevision } : {}),
  });
}

function selectSegment(source: unknown, timeZone: string): ScheduleSegmentDisplay {
  const value = record(source);
  const startInstant = instant(value.startInstant);
  const endInstant = instant(value.endInstant);
  const localStart = text(value.localStart, 32);
  const localEnd = text(value.localEnd, 32);
  const startOffset = text(value.startOffset, 12);
  const endOffset = text(value.endOffset, 12);
  const overnight = boolean(value.overnight);
  try {
    const start = Temporal.Instant.from(startInstant);
    const end = Temporal.Instant.from(endInstant);
    if (Temporal.Instant.compare(start, end) >= 0) return invalidSource();
    const expectedStart = start.toZonedDateTimeISO(timeZone);
    const expectedEnd = end.toZonedDateTimeISO(timeZone);
    if (
      localStart !== localStamp(expectedStart) ||
      localEnd !== localStamp(expectedEnd) ||
      startOffset !== expectedStart.offset ||
      endOffset !== expectedEnd.offset ||
      overnight !== !expectedStart.toPlainDate().equals(expectedEnd.toPlainDate()) ||
      expectedStart.second !== 0 ||
      expectedStart.millisecond !== 0 ||
      expectedStart.microsecond !== 0 ||
      expectedStart.nanosecond !== 0 ||
      expectedEnd.second !== 0 ||
      expectedEnd.millisecond !== 0 ||
      expectedEnd.microsecond !== 0 ||
      expectedEnd.nanosecond !== 0
    ) {
      return invalidSource();
    }
  } catch {
    return invalidSource();
  }
  return Object.freeze({
    segmentId: text(value.segmentId),
    label: text(value.label),
    startInstant,
    endInstant,
    localStart,
    localEnd,
    startOffset,
    endOffset,
    overnight,
    dstResolution: enumValue<'EXACT' | 'GAP_REJECTED' | 'FOLD_EARLIER' | 'FOLD_LATER'>(
      value.dstResolution,
      DST_RESOLUTIONS
    ),
  });
}

function selectWorkPlan(source: unknown): WorkPlanDisplay {
  const value = record(source);
  const arrangementSource = record(value.arrangement);
  const arrangementKind = enumValue<WorkArrangementKind>(arrangementSource.kind, ARRANGEMENT_KINDS);
  const extensionCode = optionalText(arrangementSource.extensionCode, 120);
  if ((arrangementKind === 'TENANT_EXTENSION') !== Boolean(extensionCode)) return invalidSource();
  const assignmentSource = record(value.assignment);
  const packSource = record(value.policyPack);
  const resolutionSource = record(value.resolution);
  const timeZone = text(value.timeZone, 120);
  if (!isValidScheduleTimeZone(timeZone)) return invalidSource();
  const effectiveStart = civilDate(value.effectiveStart);
  const effectiveEnd = value.effectiveEnd == null ? undefined : civilDate(value.effectiveEnd);
  if (effectiveEnd && Temporal.PlainDate.compare(effectiveStart, effectiveEnd) >= 0)
    return invalidSource();
  const policyPack = Object.freeze({
    state: enumValue<PolicyPackState>(packSource.state, PACK_STATES),
    jurisdiction: text(packSource.jurisdiction, 120),
    effectiveOn: civilDate(packSource.effectiveOn),
    ...(optionalText(packSource.revision, 120)
      ? { revision: optionalText(packSource.revision, 120) }
      : {}),
  });
  if (policyPack.state === 'CURRENT' && !policyPack.revision) return invalidSource();
  const resolutionState = enumValue<PolicyResolutionState>(
    resolutionSource.state,
    RESOLUTION_STATES
  );
  const winningLevel = optionalText(resolutionSource.winningLevel, 100);
  if (winningLevel && !PRECEDENCE_LEVELS.has(winningLevel)) return invalidSource();
  if (resolutionState === 'RESOLVED' && (!winningLevel || policyPack.state !== 'CURRENT')) {
    return invalidSource();
  }
  return Object.freeze({
    workPlanId: text(value.workPlanId),
    title: text(value.title),
    version: positiveInteger(value.version),
    lifecycle: enumValue<WorkPlanLifecycle>(value.lifecycle, LIFECYCLES),
    arrangement: Object.freeze({
      kind: arrangementKind,
      ...(extensionCode ? { extensionCode } : {}),
    }),
    effectiveStart,
    ...(effectiveEnd ? { effectiveEnd } : {}),
    timeZone,
    assignment: Object.freeze({
      assignmentId: text(assignmentSource.assignmentId),
      label: text(assignmentSource.label),
      snapshotRevision: text(assignmentSource.snapshotRevision, 120),
      freshness: enumValue<'CURRENT' | 'STALE'>(
        assignmentSource.freshness,
        new Set(['CURRENT', 'STALE'])
      ),
    }),
    policyPack,
    resolution: Object.freeze({
      state: resolutionState,
      ...(winningLevel ? { winningLevel: winningLevel as PolicyPrecedenceLevel } : {}),
      trace: Object.freeze(array(resolutionSource.trace).map(selectTraceStep)),
    }),
    segments: Object.freeze(
      unique(
        array(value.segments).map((segment) => selectSegment(segment, timeZone)),
        (segment) => segment.segmentId
      )
    ),
    availableActions: Object.freeze(
      unique(
        array(value.availableActions).map((action) => enumValue<WorkPlanAction>(action, ACTIONS)),
        (action) => action
      )
    ),
  });
}

export function selectWorkPlanStudioDisplay(source: unknown): WorkPlanStudioDisplay {
  const value = record(source);
  const queryState = enumValue<WorkPlanQueryState>(value.queryState, QUERY_STATES);
  const freshness = enumValue<WorkPlanFreshness>(value.freshness, FRESHNESS);
  const workPlans = unique(array(value.workPlans).map(selectWorkPlan), (plan) => plan.workPlanId);
  if (queryState === 'EMPTY' && workPlans.length > 0) return invalidSource();
  if (queryState === 'COMPLETE' && workPlans.length === 0) return invalidSource();
  if (queryState === 'UNAVAILABLE' && workPlans.length > 0) return invalidSource();
  return Object.freeze({
    queryState,
    freshness,
    asOf: instant(value.asOf),
    partialFailures: Object.freeze(array(value.partialFailures).map((item) => text(item, 500))),
    workPlans: Object.freeze(workPlans),
  });
}

function selectSimulation(source: unknown): WorkPlanSimulation {
  const value = record(source);
  const rows = array(value.rows).map((rowSource) => {
    const row = record(rowSource);
    return Object.freeze({
      key: text(row.key, 120),
      label: text(row.label),
      currentValue: text(row.currentValue),
      draftValue: text(row.draftValue),
      impact: enumValue<'INFO' | 'WARNING' | 'BLOCKING'>(row.impact, IMPACTS),
    });
  });
  return Object.freeze({
    workPlanId: text(value.workPlanId),
    baseVersion: positiveInteger(value.baseVersion),
    status: enumValue<'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' | 'STALE'>(
      value.status,
      SIMULATION_STATUSES
    ),
    generatedAt: instant(value.generatedAt),
    policyRevision: text(value.policyRevision, 120),
    rows: Object.freeze(unique(rows, (row) => row.key)),
    findings: Object.freeze(array(value.findings).map((finding) => text(finding))),
    partialFailures: Object.freeze(array(value.partialFailures).map((failure) => text(failure))),
  });
}

export function selectWorkPlanSimulationCommand(source: unknown): WorkPlanSimulationCommand {
  const value = record(source);
  const receiptSource = record(value.receipt);
  const receipt = Object.freeze({
    receiptId: text(receiptSource.receiptId),
    workPlanId: text(receiptSource.workPlanId),
    operation: enumValue<'SIMULATE'>(receiptSource.operation, new Set(['SIMULATE'])),
    idempotencyKey: text(receiptSource.idempotencyKey),
    status: enumValue<ReceiptStatus>(receiptSource.status, RECEIPT_STATUSES),
    updatedAt: instant(receiptSource.updatedAt),
  });
  const simulation = value.simulation == null ? null : selectSimulation(value.simulation);
  if (simulation && simulation.workPlanId !== receipt.workPlanId) return invalidSource();
  if (receipt.status === 'SUCCEEDED' && !simulation) return invalidSource();
  return Object.freeze({ receipt, simulation });
}

export function workPlanSimulationBlockers(
  workspace: WorkPlanStudioDisplay,
  plan: WorkPlanDisplay
): readonly string[] {
  const blockers: string[] = [];
  if (workspace.queryState !== 'COMPLETE') blockers.push(`QUERY_${workspace.queryState}`);
  if (workspace.freshness !== 'CURRENT') blockers.push(`WORKSPACE_${workspace.freshness}`);
  if (plan.assignment.freshness !== 'CURRENT') blockers.push('ASSIGNMENT_STALE');
  if (plan.policyPack.state !== 'CURRENT') blockers.push(`POLICY_PACK_${plan.policyPack.state}`);
  if (plan.resolution.state !== 'RESOLVED') blockers.push(`POLICY_${plan.resolution.state}`);
  if (!plan.availableActions.includes('SIMULATE')) blockers.push('SIMULATION_NOT_AUTHORIZED');
  return Object.freeze(blockers);
}

export function createWorkPlanSimulationRequest(
  workspace: WorkPlanStudioDisplay,
  plan: WorkPlanDisplay
): WorkPlanSimulationRequest | null {
  if (workPlanSimulationBlockers(workspace, plan).length > 0) return null;
  const policyRevision = plan.policyPack.revision;
  if (!policyRevision) return null;
  return Object.freeze({
    workPlanId: plan.workPlanId,
    expectedVersion: plan.version,
    assignmentSnapshotRevision: plan.assignment.snapshotRevision,
    policyRevision,
    purpose: 'PRE_PUBLISH_IMPACT_REVIEW',
  });
}

export function receiptNeedsReconciliation(receipt: WorkPlanReceipt): boolean {
  return ['ACCEPTED', 'RUNNING', 'RESULT_UNKNOWN', 'RECONCILING'].includes(receipt.status);
}
